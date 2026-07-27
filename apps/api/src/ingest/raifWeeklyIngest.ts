/**
 * Ingesta del boletín semanal provincial del RAIF → PestAdvisory.
 * Fase 1 del radar de boletines · 26-jul-2026.
 *
 * Convierte lo que parsea `raifWeeklyParser` en avisos publicables, uno por
 * (provincia · cultivo · plaga · semana). Todo lo que publica sale del PDF:
 * el nombre de la plaga, el científico (con las erratas del original), el
 * texto del epígrafe y la fecha del propio boletín. Lo único nuestro es el
 * centroide + radio provincial, y va marcado como tal (`radiusSource:'agrom'`).
 *
 * Atribución obligatoria: el dataset y los boletines del RAIF son
 * "Reconocimiento 4.0 Internacional (CC BY 4.0)" — uso comercial permitido
 * CITANDO la fuente. Cada aviso lleva `source:'RAIF'`, `sourceRef` con el
 * periodo literal y `sourceUrl` al PDF.
 *
 * Modo simulación (`dryRun`): parsea y devuelve lo que publicaría SIN tocar
 * la BD. Sirve para decidir la política de volumen mirando datos reales.
 */

import { PestAdvisory } from '../models/PestAdvisory.js';
import { fanOutAdvisoryAlerts } from '../services/pestAdvisoryService.js';
import { User } from '../models/User.js';
import { fetchPdfText, requireBulletinDate, PdfIngestError } from './pdfText.js';
import { parseRaifWeeklyBulletin, unmappedCrops, type ParsedPest } from './raifWeeklyParser.js';
import { logger } from '../utils/logger.js';
import type { CropType } from '@fitolink/shared';

const RAIF_BASE =
  'https://www.juntadeandalucia.es/agriculturapescaaguaydesarrollorural/raif/boletin-provincial/informe-semanal';

/**
 * Los 8 boletines provinciales. La URL del PDF se SOBRESCRIBE cada semana en
 * el mismo sitio, y su nombre de fichero es fósil (no codifica la fecha real),
 * así que la frescura la decide SIEMPRE el texto interno.
 *
 * Por eso no guardamos la URL del PDF sino la del índice provincial: la Junta
 * mueve los ficheros de carpeta (`uploads/2023/03`, `uploads/2026/02`…) pero
 * la página de la provincia no cambia.
 *
 * ⚠️ El path lleva `informe-semanal/informe-semanal-<provincia>/` (segmento
 * repetido, no es una errata). Sin el intermedio la Junta responde 301 hacia
 * `pd-web-wp-raif.apps.paas-pro.junta-andalucia.es`, que no resuelve desde
 * fuera de su red. Verificados los 8 con HTTP 200 el 27-jul-2026.
 *
 * Córdoba no publica el informe general multicultivo (solo especiales por
 * cultivo), así que su ingesta dará 'error' hasta que se cablee esa variante.
 */
export const RAIF_PROVINCE_INDEX: Array<{ province: string; indexUrl: string }> = [
  { province: 'Almeria', indexUrl: `${RAIF_BASE}/informe-semanal-almeria/` },
  { province: 'Cadiz',   indexUrl: `${RAIF_BASE}/informe-semanal-cadiz/` },
  { province: 'Cordoba', indexUrl: `${RAIF_BASE}/informe-semanal-cordoba/` },
  { province: 'Granada', indexUrl: `${RAIF_BASE}/informe-semanal-granada/` },
  { province: 'Huelva',  indexUrl: `${RAIF_BASE}/informe-semanal-huelva/` },
  { province: 'Jaen',    indexUrl: `${RAIF_BASE}/informe-semanal-jaen/` },
  { province: 'Malaga',  indexUrl: `${RAIF_BASE}/informe-semanal-malaga/` },
  { province: 'Sevilla', indexUrl: `${RAIF_BASE}/informe-semanal-sevilla/` },
];

/** Centroide de la capital + radio que cubre la provincia. NUESTRO, no de la fuente. */
const PROVINCE_GEO: Record<string, { coordinates: [number, number]; radiusKm: number }> = {
  Almeria: { coordinates: [-2.46, 36.84], radiusKm: 80 },
  Cadiz:   { coordinates: [-5.79, 36.62], radiusKm: 80 },
  Cordoba: { coordinates: [-4.78, 37.89], radiusKm: 90 },
  Granada: { coordinates: [-3.60, 37.18], radiusKm: 85 },
  Huelva:  { coordinates: [-6.94, 37.26], radiusKm: 80 },
  Jaen:    { coordinates: [-3.79, 37.77], radiusKm: 90 },
  Malaga:  { coordinates: [-4.42, 36.72], radiusKm: 80 },
  Sevilla: { coordinates: [-5.98, 37.39], radiusKm: 90 },
};

/**
 * QUÉ LLEGA A LA CAMPANITA DEL AGRICULTOR.
 *
 * El boletín trae ~151 avisos por semana entre las 7 provincias. Todos van al
 * tablón (es el canal: información oficial dispersa, reunida). Pero convertir
 * cada uno en alerta de parcela daría 80 alertas semanales en el entorno demo
 * —12 por agricultor de la cooperativa— y eso no es vigilancia, es ruido.
 *
 *  'destacados' → solo los que el propio boletín lista en "Agentes destacados"
 *                 (~13 de 151). El filtro NO es nuestro: lo decide la fuente.
 *  'todos'      → fan-out completo. Ojo al volumen.
 *  'ninguno'    → el tablón es el canal y la campanita se reserva para
 *                 satélite, fuegos y detecciones concretas.
 */
const FANOUT_POLICY: 'destacados' | 'todos' | 'ninguno' = 'destacados';

/** Antigüedad máxima del boletín para considerarlo vigente (semanal + margen). */
const MAX_AGE_DAYS = 12;
/** Duración máxima creíble del periodo de un boletín semanal (L-V + margen). */
const MAX_WEEK_SPAN_DAYS = 10;
/** Longitud del extracto que se guarda en notes (el original está a un clic). */
const SNIPPET_CHARS = 600;

export interface PlannedAdvisory {
  province: string;
  cropLabel: string;
  cropType: CropType;
  pestName: string;
  scientificName?: string;
  highlightedBySource: boolean;
  snippet: string;
  fingerprint: string;
  periodLiteral: string;
  sourceUrl: string;
}

export interface RaifWeeklyResult {
  province: string;
  status: 'ok' | 'sin-cambios' | 'error';
  periodLiteral?: string;
  planned: PlannedAdvisory[];
  unmapped: string[];
  error?: string;
}

/**
 * Descubre la URL del PDF semanal desde el índice provincial. NO se construye
 * a mano: el nombre de fichero es arbitrario y cambia sin avisar.
 */
export async function discoverWeeklyPdfUrl(indexUrl: string): Promise<string | null> {
  let html: string;
  try {
    const res = await fetch(indexUrl, {
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': 'FitoLink/1.0 (+https://fitolink.agrom.es)' },
    });
    if (!res.ok) {
      logger.warn({ indexUrl, status: res.status }, 'raif_weekly_index_http_error');
      return null;
    }
    html = await res.text();
  } catch (err) {
    logger.warn({ indexUrl, err: (err as Error).message }, 'raif_weekly_index_fetch_failed');
    return null;
  }

  // Exigimos el "Informe_Fitosanitario" general (multicultivo). Los
  // "Informe_EspecialInteres_<Cultivo>" que cuelgan de la misma página son
  // otro documento con otra maquetación: coger uno por descarte sería
  // pasárselo a un parser que no lo entiende. Mejor no publicar nada.
  const pdfs = [...html.matchAll(/href="([^"]+\.pdf)"/gi)].map((m) => m[1]);
  const general = pdfs.find((u) => /Informe_Fitosanitario/i.test(u));
  if (!general) {
    logger.warn({ indexUrl, pdfsFound: pdfs.length }, 'raif_weekly_general_report_missing');
    return null;
  }
  return general.startsWith('http') ? general : new URL(general, indexUrl).toString();
}

/** Fingerprint estable por provincia+cultivo+plaga+semana. */
function fingerprintFor(province: string, cropType: CropType, pestName: string, periodEnd: Date): string {
  const week = periodEnd.toISOString().slice(0, 10);
  const slug = pestName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `raif-sem-${province.toLowerCase()}-${cropType}-${slug}-${week}`;
}

function snippetOf(pest: ParsedPest): string {
  const body = pest.body.trim();
  if (body.length <= SNIPPET_CHARS) return body;
  // Corta en el final de frase más cercano para no dejar la cita a medias
  const cut = body.slice(0, SNIPPET_CHARS);
  const lastStop = cut.lastIndexOf('. ');
  return (lastStop > SNIPPET_CHARS * 0.5 ? cut.slice(0, lastStop + 1) : cut) + ' […]';
}

/**
 * Procesa el boletín de UNA provincia. Con `dryRun` no toca la BD.
 * Fail-closed: cualquier fallo de descarga, fecha o estructura → status 'error'
 * y cero escrituras.
 */
export async function ingestProvinceWeekly(
  entry: { province: string; indexUrl: string },
  opts: { dryRun?: boolean } = {},
): Promise<RaifWeeklyResult> {
  const { province, indexUrl } = entry;
  const base: RaifWeeklyResult = { province, status: 'error', planned: [], unmapped: [] };

  const pdfUrl = await discoverWeeklyPdfUrl(indexUrl);
  if (!pdfUrl) return { ...base, error: 'No se encontró el PDF en el índice provincial' };

  let doc;
  try {
    doc = await fetchPdfText(pdfUrl);
  } catch (err) {
    const e = err as PdfIngestError;
    return { ...base, error: `${e.message}${e.detail ? ` · ${e.detail}` : ''}` };
  }

  let period;
  try {
    period = requireBulletinDate(doc.text, MAX_AGE_DAYS, pdfUrl);
  } catch (err) {
    return { ...base, error: (err as Error).message };
  }

  // Tercera capa sobre la fecha: esto es un boletín SEMANAL. Si el periodo que
  // hemos leído dura un mes, o no tiene inicio, es que no hemos cogido la
  // cabecera sino alguna fecha suelta del cuerpo. Antes que publicar un ámbito
  // temporal que el PDF no declara, no se publica.
  if (!period.periodStart) {
    return { ...base, error: `El periodo leído ("${period.literal}") no tiene fecha de inicio — no es la cabecera semanal` };
  }
  const spanDays = (period.periodEnd.getTime() - period.periodStart.getTime()) / 86_400_000;
  if (spanDays < 0 || spanDays > MAX_WEEK_SPAN_DAYS) {
    return {
      ...base,
      error: `El periodo leído ("${period.literal}") abarca ${Math.round(spanDays)} días — un boletín semanal no dura eso, no se publica`,
    };
  }

  const parsed = parseRaifWeeklyBulletin(doc.text);
  if (!parsed) return { ...base, error: 'No se reconoció la estructura del boletín' };

  const geo = PROVINCE_GEO[province];
  if (!geo) return { ...base, error: `Sin centroide para la provincia ${province}` };

  const planned: PlannedAdvisory[] = [];
  for (const section of parsed.sections) {
    if (!section.cropType) continue; // cultivo no mapeado → no se publica
    for (const pest of section.pests) {
      planned.push({
        province,
        cropLabel: section.cropLabel,
        cropType: section.cropType,
        pestName: pest.name,
        scientificName: pest.scientificName,
        highlightedBySource: pest.highlightedBySource,
        snippet: snippetOf(pest),
        fingerprint: fingerprintFor(province, section.cropType, pest.name, period.periodEnd),
        periodLiteral: period.literal,
        sourceUrl: pdfUrl,
      });
    }
  }

  const result: RaifWeeklyResult = {
    province,
    status: 'ok',
    periodLiteral: period.literal,
    planned,
    unmapped: unmappedCrops(parsed),
  };

  if (opts.dryRun) return result;

  try {
    return await writeProvinceAdvisories(entry, planned, period, result);
  } catch (err) {
    // El contrato es fail-closed POR PROVINCIA: un fallo de Mongo aquí no
    // puede tumbar el run de las otras seis. Lo ya insertado queda (el upsert
    // es idempotente) y el run de la semana siguiente lo completa.
    logger.error({ province, err: (err as Error).message }, 'raif_weekly_write_failed');
    return { ...base, error: `Fallo al escribir en BD: ${(err as Error).message}` };
  }
}

/** Persiste los avisos de una provincia. Separado para acotar el try/catch. */
async function writeProvinceAdvisories(
  entry: { province: string; indexUrl: string },
  planned: PlannedAdvisory[],
  period: { periodEnd: Date; literal: string },
  result: RaifWeeklyResult,
): Promise<RaifWeeklyResult> {
  const { province, indexUrl } = entry;
  const geo = PROVINCE_GEO[province];
  const admin = await User.findOne({ googleId: 'demo-admin-001' }).select('_id');
  if (!admin) {
    return { province, status: 'error', planned: [], unmapped: [], error: 'demo-admin-001 no existe — BD sin inicializar' };
  }

  // Vigencia: hasta el siguiente boletín + margen. Un parte de campo caduca
  // rápido: no se deja vivo un mes (ver expiresAt en el modelo).
  const expiresAt = new Date(period.periodEnd.getTime() + 10 * 24 * 60 * 60 * 1000);

  let inserted = 0;
  let fannedOut = 0;
  for (const p of planned) {
    // La decisión se calcula UNA vez y se guarda en el documento. Si viviera
    // solo aquí, el barrido de ingestRaif (que recorre todos los avisos
    // vigentes) la anularía el lunes siguiente y notificaría los 151.
    const notifica =
      FANOUT_POLICY === 'todos' || (FANOUT_POLICY === 'destacados' && p.highlightedBySource);

    const r = await PestAdvisory.updateOne(
      { fingerprint: p.fingerprint },
      {
        $setOnInsert: {
          notifyParcels: notifica,
          pestName: p.scientificName ? `${titleCase(p.pestName)} · ${p.scientificName}` : titleCase(p.pestName),
          scientificName: p.scientificName,
          cropTypes: [p.cropType],
          affectedAreas: [{
            province,
            comarca: `Provincia de ${province}`,
            centroid: { type: 'Point' as const, coordinates: geo.coordinates },
            radiusKm: geo.radiusKm,
            radiusSource: 'agrom' as const,
          }],
          // El boletín NO publica severidad. Se deja 'medium' neutro y se
          // marca si la propia fuente destacó el agente esa semana.
          severity: 'medium' as const,
          advisoryKind: 'deteccion' as const,
          sourceScopeLiteral: `Provincia de ${province} · ${p.periodLiteral}`,
          detectedAt: period.periodEnd,
          expiresAt,
          source: 'RAIF' as const,
          sourceRef: `Boletín Fitosanitario semanal · ${p.cropLabel} · ${province} · ${p.periodLiteral}`,
          recommendation: 'Consulte el boletín oficial completo en el enlace y coteje el estado en cada parcela antes de decidir tratamiento.',
          notes: (p.highlightedBySource ? '[Agente destacado por el boletín] ' : '') + p.snippet,
          // Se cita el ÍNDICE provincial, no el PDF. La Junta sobrescribe el
          // fichero en la misma URL cada semana, y como el aviso vive hasta 10
          // días después del periodo, el enlace al PDF acabaría sirviendo otra
          // semana distinta de la que dice `sourceRef`. El índice es estable y
          // siempre lleva al boletín vigente. La semana citada va en sourceRef.
          sourceUrl: indexUrl,
          createdBy: admin._id,
          fingerprint: p.fingerprint,
          isActive: true,
        },
      },
      { upsert: true },
    );
    if (r.upsertedCount === 0) continue; // ya existía: ni se toca ni se re-avisa
    inserted += 1;
    if (!notifica) continue;
    // Se busca el documento recién insertado porque el fan-out necesita la
    // geometría ya persistida para cruzarla con las parcelas.
    const doc = await PestAdvisory.findOne({ fingerprint: p.fingerprint });
    if (!doc) continue;
    const fan = await fanOutAdvisoryAlerts(doc);
    fannedOut += fan.alertsCreated;
  }

  logger.info(
    {
      province,
      period: period.literal,
      planned: planned.length,
      inserted,
      fanoutPolicy: FANOUT_POLICY,
      alertsCreated: fannedOut,
      unmapped: result.unmapped,
    },
    'raif_weekly_ingest_completed',
  );
  return result;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
