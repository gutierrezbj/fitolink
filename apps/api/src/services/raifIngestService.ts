/**
 * raifIngestService · F1 día 2-3 · ingestor RAIF Andalucía — SCRAPER REAL.
 *
 * Visión PM (JuanCho 9-jun-2026): cubrir los 17 servicios fitosanitarios
 * autonómicos de España con scrapers per CCAA. F1 cubre las 4 CCAA con
 * mayor cobertura del mercado agrícola español (~60% PIB agrícola):
 *   - RAIF Andalucía       (este servicio · LIVE 12-jul-2026)
 *   - DARP Cataluña        (futuro · darpIngestService)
 *   - SAIF/IVIA Valencia   (futuro · saifIngestService)
 *   - IRIAF Castilla-La Mancha (futuro · iriafIngestService)
 *
 * Cómo funciona (12-jul-2026):
 *   1. `fetchPraysOleaeReport()` descarga el HTML del informe "Estado
 *      fitosanitario actual de Prays oleae en Andalucía" del portal RAIF
 *      (página WordPress server-rendered · verificado parseable por curl,
 *      sin JS) y lo parsea con `parsePraysHtml()`.
 *   2. `ingestPraysReport()` compara la fecha de publicación del informe
 *      con lo que ya hay en la colección PestAdvisory:
 *        - informe NO más nuevo → no-op (log `raif_ingest_up_to_date`).
 *          El tablón conserva su fecha honesta; NO se fabrica frescura.
 *        - informe MÁS NUEVO → borra los advisories Prays anteriores e
 *          inserta uno por provincia con las cifras LITERALES parseadas.
 *   3. El runner `dist/ingest/ingestRaif.js` (crontab del host, semanal)
 *      ejecuta el paso 2 y dispara el fan-out de alertas a usuarios con
 *      parcelas de olivo dentro del radio (pestAlertService).
 *
 * Honor CRITICAL_no_inventar:
 *   - Solo se ingesta lo que el parser extrae LITERALMENTE del portal
 *     (cifras, provincias, fenología, calificador de capturas). Nada de
 *     rellenos ni severidades inventadas: la severidad sale del propio
 *     calificador del portal ("nivel de capturas bajo/medio/alto") y si
 *     no aparece se usa 'medium' neutro.
 *   - FAIL-CLOSED: si el HTML cambia y el parser no encuentra fecha o no
 *     encuentra NINGUNA cifra provincial, lanza ParseError y NO se toca
 *     la BD (los advisories existentes siguen siendo la última verdad
 *     verificada). Los logs capturan un extracto del body (logs-con-body).
 *
 * F1 día 4-6 (futuro): ampliar a otros informes del portal (Bactrocera
 * oleae · repilo · Saissetia) — cada uno con su URL y su parser.
 */

import { PestAdvisory } from '../models/PestAdvisory.js';
import { User } from '../models/User.js';
import { Alert } from '../models/Alert.js';
import { logger } from '../utils/logger.js';

// ── Tipos compartidos ─────────────────────────────────────────────────

export type RaifProvince =
  | 'Almeria' | 'Cadiz' | 'Cordoba' | 'Granada'
  | 'Huelva' | 'Jaen' | 'Malaga' | 'Sevilla';

export interface RaifProvinceReport {
  /** Nombre canónico provincia (debe matchear PROVINCES en @fitolink/shared) */
  province: RaifProvince;
  /** % aceitunas con plaga vivo (si lo reporta el portal · undefined si no) */
  percentInfested?: number;
  /** Adultos/trampa/día capturados (si lo reporta el portal) */
  capturesPerTrapPerDay?: number;
  /** % supervivencia de larvas (si lo reporta el portal) */
  larvaSurvivalPercent?: number;
}

export interface RaifPestReport {
  /** Plaga/enfermedad concreta */
  pestScientificName: string;
  pestCommonName: string;
  /** Fecha publicación del informe en el portal */
  reportPublishedAt: Date;
  /** Calificador del nivel de capturas que usa el propio portal (bajo/medio/alto) */
  captureLevelQualifier?: 'bajo' | 'medio' | 'alto';
  /** Estado fenológico dominante del cultivo según portal (e.g. "H") */
  phenologicalStage?: string;
  /** Datos por provincia */
  provinces: RaifProvinceReport[];
  /** URL canónica del informe en el portal RAIF */
  sourceUrl: string;
}

export interface RaifIngestResult {
  status: 'up-to-date' | 'ingested' | 'error';
  reportPublishedAt?: Date;
  latestInDb?: Date | null;
  deleted?: number;
  inserted?: number;
  /** Fingerprints de los advisories insertados (para el fan-out de alertas) */
  fingerprints?: string[];
  error?: string;
}

export class RaifParseError extends Error {
  constructor(message: string, public htmlExcerpt?: string) {
    super(message);
    this.name = 'RaifParseError';
  }
}

// ── Constantes ────────────────────────────────────────────────────────

export const RAIF_PRAYS_URL =
  'https://www.juntadeandalucia.es/agriculturapescaaguaydesarrollorural/raif/estado-fitosanitario-actual-de-prays-oleae-en-andalucia/';

const FETCH_TIMEOUT_MS = 10_000;

/** Prefijo común de los fingerprints Prays (seed oct-2025 e ingesta usan el mismo). */
export const PRAYS_FINGERPRINT_PREFIX = 'polilla-olivo-RAIF-';

/**
 * Centroides PROVINCIALES (capital) con radio amplio: el dato del portal es
 * "valor medio provincial", así que el área honesta es la provincia entera,
 * no una comarca concreta.
 */
const PROVINCE_CENTROIDS: Record<RaifProvince, { coordinates: [number, number]; radiusKm: number }> = {
  Almeria: { coordinates: [-2.46, 36.84], radiusKm: 80 },
  Cadiz:   { coordinates: [-5.79, 36.62], radiusKm: 80 },
  Cordoba: { coordinates: [-4.78, 37.89], radiusKm: 90 },
  Granada: { coordinates: [-3.60, 37.18], radiusKm: 85 },
  Huelva:  { coordinates: [-6.94, 37.26], radiusKm: 80 },
  Jaen:    { coordinates: [-3.79, 37.77], radiusKm: 90 },
  Malaga:  { coordinates: [-4.42, 36.72], radiusKm: 80 },
  Sevilla: { coordinates: [-5.98, 37.39], radiusKm: 90 },
};

/** Normaliza el nombre de provincia del portal (con tildes) al canónico del schema. */
function canonicalProvince(raw: string): RaifProvince | null {
  const normalized = raw
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const valid: RaifProvince[] = ['Almeria', 'Cadiz', 'Cordoba', 'Granada', 'Huelva', 'Jaen', 'Malaga', 'Sevilla'];
  return valid.find((p) => p.toLowerCase() === normalized.toLowerCase()) ?? null;
}

/**
 * "45,1" → 45.1 · el portal usa coma decimal. FAIL-CLOSED (12-jul-2026):
 * un "16.1" con punto decimal NO debe convertirse en 161 en silencio —
 * si el formato es ambiguo o el valor es absurdo para este dominio
 * (porcentajes y adultos/trampa/día, siempre < 1000), lanzamos y la
 * ingesta entera aborta con la BD intacta.
 */
function parseSpanishNumber(raw: string): number {
  const t = raw.trim();
  let n: number;
  if (t.includes(',')) {
    n = Number(t.replace(/\./g, '').replace(',', '.'));
  } else if (/^\d+\.\d{1,2}$/.test(t)) {
    n = Number(t); // punto decimal (redactor no habitual) — NO es separador de miles
  } else if (/^\d+$/.test(t)) {
    n = Number(t);
  } else {
    n = NaN;
  }
  if (!Number.isFinite(n) || n < 0 || n >= 1000) {
    throw new RaifParseError(`Cifra no parseable con seguridad: "${raw}"`);
  }
  return n;
}

/** "Málaga, Córdoba y Sevilla" → ['Malaga','Cordoba','Sevilla'] (solo válidas). */
function parseProvinceList(raw: string): RaifProvince[] {
  return raw
    .split(/,|\by\b/)
    .map((s) => canonicalProvince(s))
    .filter((p): p is RaifProvince => p !== null);
}

// ── Parser (puro · testeable sin red) ─────────────────────────────────

/**
 * Parsea el HTML del informe Prays del portal RAIF.
 *
 * Patrones verificados contra el HTML real (11-jul-2026):
 *  - Fecha:   <span class="meta-date date published">01/10/25</span>
 *  - % vivo:  "provincias de <strong>Málaga, Córdoba y Sevilla</strong>,
 *              con ... del 45,1%, 35,1% y 35% de aceitunas con Prays vivo"
 *    (aparece 2 veces: incidencia carpófaga de junio + supervivencia larvas;
 *     distinguimos por el texto previo "supervivencia")
 *  - Trampas: "provincias de <strong>Málaga, Sevilla y Cádiz</strong>, con
 *              valores de 16,1; 5,7 y 4,1 adultos/trampa/día"
 *  - Fenología: 'estado fenológico dominante "H"'
 *  - Calificador: "siendo el nivel de capturas bajo"
 *
 * FAIL-CLOSED: lanza RaifParseError si falta la fecha o si no se extrae
 * NINGUNA cifra provincial.
 */
export function parsePraysHtml(html: string): RaifPestReport {
  // 1. Fecha de publicación (DD/MM/YY o DD/MM/YYYY)
  const dateM = html.match(/class="meta-date date published">(\d{2})\/(\d{2})\/(\d{2,4})</);
  if (!dateM) {
    throw new RaifParseError('No se encontró la fecha de publicación (meta-date published)', html.slice(0, 300));
  }
  const [, dd, mm, yyRaw] = dateM;
  const yyyy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
  const reportPublishedAt = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  // Round-trip: un 31/02 haría rollover silencioso a marzo — fail-closed.
  if (
    Number.isNaN(reportPublishedAt.getTime()) ||
    reportPublishedAt.getUTCDate() !== Number(dd) ||
    reportPublishedAt.getUTCMonth() + 1 !== Number(mm) ||
    reportPublishedAt.getUTCFullYear() !== Number(yyyy)
  ) {
    throw new RaifParseError(`Fecha de publicación no parseable: ${dd}/${mm}/${yyRaw}`);
  }

  const byProvince = new Map<RaifProvince, RaifProvinceReport>();
  const upsert = (p: RaifProvince): RaifProvinceReport => {
    let entry = byProvince.get(p);
    if (!entry) {
      entry = { province: p };
      byProvince.set(p, entry);
    }
    return entry;
  };

  // 2. Grupos "% de aceitunas con Prays vivo" (incidencia y supervivencia)
  const pctRe = /([^.]{0,160})provincias de\s*<strong>([^<]+)<\/strong>\s*,\s*con[^.]*?del\s*([\d.,]+)%\s*,\s*([\d.,]+)%\s*y\s*([\d.,]+)%\s*de aceitunas con Prays vivo/g;
  let m: RegExpExecArray | null;
  while ((m = pctRe.exec(html))) {
    const [, before, provincesRaw, v1, v2, v3] = m;
    const provinces = parseProvinceList(provincesRaw);
    const values = [v1, v2, v3].map(parseSpanishNumber);
    if (provinces.length !== 3) continue; // grupo malformado → lo saltamos, no inventamos
    // Clasificación POSITIVA obligatoria (12-jul-2026): si el texto previo no
    // se identifica claramente como supervivencia o como incidencia (o marca
    // ambas), descartamos el grupo — no atribuimos cifras a ciegas.
    const isSurvival = /supervivencia|interior del hueso/i.test(before);
    const isIncidence = /carpófaga|carpofaga|incidencia|infestad/i.test(before);
    if (isSurvival === isIncidence) continue;
    provinces.forEach((p, i) => {
      const entry = upsert(p);
      if (isSurvival) entry.larvaSurvivalPercent = values[i];
      else entry.percentInfested = values[i];
    });
  }

  // 3. Grupo "adultos/trampa/día"
  const trapRe = /provincias de\s*<strong>([^<]+)<\/strong>\s*,\s*con valores de\s*([\d.,]+);\s*([\d.,]+)\s*y\s*([\d.,]+)\s*adultos\/trampa\/d/g;
  while ((m = trapRe.exec(html))) {
    const [, provincesRaw, v1, v2, v3] = m;
    const provinces = parseProvinceList(provincesRaw);
    const values = [v1, v2, v3].map(parseSpanishNumber);
    if (provinces.length !== 3) continue;
    provinces.forEach((p, i) => {
      upsert(p).capturesPerTrapPerDay = values[i];
    });
  }

  if (byProvince.size === 0) {
    throw new RaifParseError('No se extrajo NINGUNA cifra provincial — ¿cambió la estructura del portal?', html.slice(0, 300));
  }

  // 4. Fenología + calificador de capturas (opcionales · si no están, undefined)
  const fenoM = html.match(/estado fenológico dominante\s*(?:<[^>]+>)*\s*[“"]([A-Z0-9]+)[”"]/);
  const qualM = html.match(/nivel de capturas\s+(bajo|medio|alto)/i);

  return {
    pestScientificName: 'Prays oleae',
    pestCommonName: 'polilla del olivo',
    reportPublishedAt,
    captureLevelQualifier: qualM ? (qualM[1].toLowerCase() as 'bajo' | 'medio' | 'alto') : undefined,
    phenologicalStage: fenoM?.[1],
    provinces: Array.from(byProvince.values()),
    sourceUrl: RAIF_PRAYS_URL,
  };
}

// ── Fetch ─────────────────────────────────────────────────────────────

/**
 * Descarga y parsea el informe Prays del portal RAIF (scraper real).
 * Logs-con-body en cualquier fallo externo.
 */
export async function fetchPraysOleaeReport(): Promise<RaifPestReport> {
  let res: Response;
  try {
    res = await fetch(RAIF_PRAYS_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'FitoLink/1.0 (+https://fitolink.agrom.es)' },
    });
  } catch (err) {
    logger.warn({ source: 'RAIF', url: RAIF_PRAYS_URL, err: (err as Error).message }, 'raif_fetch_network_error');
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.warn({ source: 'RAIF', status: res.status, body: body.slice(0, 200) }, 'raif_fetch_http_error');
    throw new Error(`RAIF Prays fetch failed: HTTP ${res.status}`);
  }
  const html = await res.text();
  const report = parsePraysHtml(html);
  logger.info(
    {
      source: 'RAIF',
      reportPublishedAt: report.reportPublishedAt.toISOString().slice(0, 10),
      provinces: report.provinces.length,
      phenology: report.phenologicalStage,
      captureLevel: report.captureLevelQualifier,
    },
    'raif_fetch_parsed',
  );
  return report;
}

// ── Construcción de advisories (solo datos parseados · cero relleno) ──

const SEVERITY_BY_QUALIFIER: Record<string, 'low' | 'medium' | 'high'> = {
  bajo: 'low',
  medio: 'medium',
  alto: 'high',
};

function buildProvinceAdvisory(
  report: RaifPestReport,
  prov: RaifProvinceReport,
  createdBy: unknown,
) {
  const monthIso = report.reportPublishedAt.toISOString().slice(0, 7); // YYYY-MM
  const dateEs = report.reportPublishedAt.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
  const geo = PROVINCE_CENTROIDS[prov.province];

  const dataPoints: string[] = [];
  if (prov.percentInfested !== undefined) {
    dataPoints.push(`${String(prov.percentInfested).replace('.', ',')}% de aceitunas con Prays vivo (incidencia generación carpófaga, valor medio provincial)`);
  }
  if (prov.capturesPerTrapPerDay !== undefined) {
    dataPoints.push(`${String(prov.capturesPerTrapPerDay).replace('.', ',')} adultos/trampa/día`);
  }
  if (prov.larvaSurvivalPercent !== undefined) {
    dataPoints.push(`${String(prov.larvaSurvivalPercent).replace('.', ',')}% de supervivencia de larvas en hueso`);
  }

  return {
    pestName: 'Prays oleae · polilla del olivo',
    scientificName: report.pestScientificName,
    cropTypes: ['olivo'],
    affectedAreas: [
      {
        province: prov.province,
        comarca: `Provincia de ${prov.province} · valor medio provincial`,
        centroid: { type: 'Point' as const, coordinates: geo.coordinates },
        radiusKm: geo.radiusKm,
      },
    ],
    severity: report.captureLevelQualifier
      ? SEVERITY_BY_QUALIFIER[report.captureLevelQualifier]
      : ('medium' as const),
    detectedAt: report.reportPublishedAt,
    // Vigente hasta nueva publicación del portal (el propio ingest la
    // sustituirá cuando RAIF republique). La frescura honesta la da
    // detectedAt visible en la card.
    expiresAt: new Date(report.reportPublishedAt.getTime() + 3 * 365 * 24 * 60 * 60 * 1000),
    source: 'RAIF' as const,
    sourceRef: `Estado Prays oleae · informe RAIF ${dateEs} · Junta de Andalucía (ingesta automática)`,
    recommendation:
      'Última publicación oficial vigente del portal RAIF. Consulte el informe completo en el enlace y coteje el estado en cada parcela antes de decidir tratamiento.',
    sourceUrl: report.sourceUrl,
    notes:
      `Datos literales del portal RAIF (informe ${dateEs}): ${dataPoints.join(' · ')}.` +
      (report.phenologicalStage ? ` Estado fenológico dominante del olivar: "${report.phenologicalStage}".` : '') +
      (report.captureLevelQualifier ? ` El portal califica el nivel de capturas como ${report.captureLevelQualifier}.` : ''),
    createdBy,
    fingerprint: `${PRAYS_FINGERPRINT_PREFIX}${prov.province}-${monthIso}`,
    isActive: true,
  };
}

// ── Ingesta (gate por fecha · fail-closed) ────────────────────────────

/**
 * Ingesta el informe Prays si (y solo si) el portal publicó uno MÁS NUEVO
 * que lo que ya hay en la BD. Devuelve el resultado para que el runner
 * dispare el fan-out de alertas.
 */
export async function ingestPraysReport(opts: { force?: boolean } = {}): Promise<RaifIngestResult> {
  const report = await fetchPraysOleaeReport();

  // Última fecha Prays ya en BD (seed oct-2025 o ingesta previa)
  const latest = await PestAdvisory.findOne({
    fingerprint: { $regex: `^${PRAYS_FINGERPRINT_PREFIX}` },
  })
    .sort({ detectedAt: -1 })
    .select('detectedAt')
    .lean();

  const latestInDb = latest?.detectedAt ?? null;

  // Gate por fecha + COMPLETITUD (12-jul-2026): con la misma fecha, si un
  // run anterior murió a mitad del bucle de inserts, faltan provincias —
  // en ese caso re-ingerimos (el delete+reinsert es la vía de reparación).
  // Si el informe del portal es más VIEJO que la BD, jamás degradamos.
  const isNewer = !latestInDb || report.reportPublishedAt.getTime() > latestInDb.getTime();
  let incompleteSameDate = false;
  if (!isNewer && latestInDb && report.reportPublishedAt.getTime() === latestInDb.getTime()) {
    const sameDateCount = await PestAdvisory.countDocuments({
      fingerprint: { $regex: `^${PRAYS_FINGERPRINT_PREFIX}` },
      detectedAt: report.reportPublishedAt,
    });
    incompleteSameDate = sameDateCount < report.provinces.length;
  }

  if (!opts.force && !isNewer && !incompleteSameDate) {
    logger.info(
      {
        source: 'RAIF',
        reportPublishedAt: report.reportPublishedAt.toISOString().slice(0, 10),
        latestInDb: latestInDb ? latestInDb.toISOString().slice(0, 10) : null,
      },
      'raif_ingest_up_to_date',
    );
    return { status: 'up-to-date', reportPublishedAt: report.reportPublishedAt, latestInDb };
  }

  const admin = await User.findOne({ googleId: 'demo-admin-001' });
  if (!admin) {
    throw new Error('demo-admin-001 not found — la BD no está inicializada (run main seed first)');
  }

  const advisories = report.provinces.map((p) => buildProvinceAdvisory(report, p, admin._id));

  // Reemplazo atómico-ish: fuera los Prays anteriores, dentro los nuevos.
  const del = await PestAdvisory.deleteMany({ fingerprint: { $regex: `^${PRAYS_FINGERPRINT_PREFIX}` } });
  let inserted = 0;
  for (const adv of advisories) {
    const r = await PestAdvisory.updateOne(
      { fingerprint: adv.fingerprint },
      { $setOnInsert: adv },
      { upsert: true },
    );
    if (r.upsertedCount > 0) inserted += 1;
  }

  // Anti-zombis (12-jul-2026): las alertas abiertas de advisories Prays que
  // acabamos de REEMPLAZAR quedarían "vigentes" para siempre apuntando a un
  // aviso borrado. Se auto-resuelven (sin resolvedBy: no es feedback del
  // agricultor y no debe contaminar el reentrenamiento del detector).
  const staleAlerts = await Alert.updateMany(
    {
      type: 'pest_advisory',
      status: { $in: ['new', 'notified', 'acknowledged'] },
      advisoryFingerprint: {
        $regex: `^${PRAYS_FINGERPRINT_PREFIX}`,
        $nin: advisories.map((a) => a.fingerprint),
      },
    },
    { $set: { status: 'resolved' } },
  );
  if (staleAlerts.modifiedCount > 0) {
    logger.info({ resolvedStale: staleAlerts.modifiedCount }, 'raif_ingest_resolved_stale_alerts');
  }

  logger.info(
    {
      source: 'RAIF',
      reportPublishedAt: report.reportPublishedAt.toISOString().slice(0, 10),
      deleted: del.deletedCount,
      inserted,
      forced: opts.force === true,
    },
    'raif_ingest_completed',
  );

  return {
    status: 'ingested',
    reportPublishedAt: report.reportPublishedAt,
    latestInDb,
    deleted: del.deletedCount,
    inserted,
    fingerprints: advisories.map((a) => a.fingerprint),
  };
}
