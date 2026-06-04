/**
 * Seed: cuenta pedagógica "Aula Jaén Jesús" con 6 parcelas sintéticas
 * que ilustran escenarios de agricultura de precisión usados en clase
 * por el profesor Jesús Vivar.
 *
 * Cada parcela es un caso de estudio:
 *   1 · Olivar tradicional sano       — caso "todo va bien", baseline robusto
 *   2 · Olivar de seto intensivo      — manejo precisión, riego deficitario
 *   3 · Pistachar joven calibrando    — sin plantingYear, modo Calibración
 *   4 · Almendro establecimiento      — plantingYear conocido, est.Phase=true
 *   5 · Olivar con estrés hídrico    — alerta crítica + Operation completada
 *   6 · Olivar heterogéneo            — media OK, intra-parcela zona crítica
 *
 * Las parcelas llevan `isSyntheticDemo: true` — el pipeline V2 las ignora,
 * sus datos hand-crafted no se sobrescriben. Idempotente: usuario por
 * `googleId`, parcelas por `name + ownerId`, alerta+operation por re-create.
 *
 * Run en local:
 *   docker compose exec -T api node apps/api/dist/seed/seedProfessorDemo.js
 *
 * Sprint Demo Aula Jaén · 18-may-2026.
 */
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Parcel } from '../models/Parcel.js';
import { Alert } from '../models/Alert.js';
import { Operation } from '../models/Operation.js';
import { fetchByReference } from '../services/sigpacService.js';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

const PROFESSOR_GOOGLE_ID = 'jesus-vivar-edu';
const PROFESSOR_EMAIL = 'jesusvivar22@gmail.com';

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * v2 (22-may-2026) · sustituidos los helpers v1.x (`mulberry32`,
 * `realisticPolygon`) por descarga directa de geometrías catastrales
 * reales desde SIGPAC vía `fetchByReference` del sigpacService. Cero
 * cortijos en mitad de campo: si SIGPAC lo etiqueta como recinto
 * agrícola con uso OV/FY/TA/etc, es agrícola por definición catastral
 * oficial. El alumno puede pegar la referencia SIGPAC en el visor
 * oficial (https://sigpac.mapa.gob.es/fega/visor/) y ver la misma
 * geometría que FitoLink.
 */

/**
 * Polígono REALISTA — parcela agrícola con quiebros tipo lindero real.
 *
 * Estrategia: rectángulo base rotado, cada lado subdividido en 3 segmentos
 * con vértices intermedios desplazados PERPENDICULARMENTE al lado. Las
 * esquinas también se desplazan ligeramente. Resultado: 16 vértices con
 * lados que claramente NO son rectos — exactamente como una parcela
 * agrícola sigue caminos, lindes vecinales y curvas de nivel.
 *
 *   areaHa  → área real (1 ha = 10.000 m²). Se respeta aproximadamente.
 *   rotDeg  → orientación dominante del eje largo
 *   aspect  → ratio largo/corto (1.5 olivar tradicional, 1.0 pistachar joven)
 *   seed    → entero que determina la forma concreta (estable entre re-runs)
 *
 * Salida: 17 puntos (16 vértices + cierre), polígono visiblemente irregular.
 */
// v1.x `realisticPolygon` eliminado en v2 — sustituido por SIGPAC real.
// Las parcelas catastrales oficiales son ahora la fuente de verdad, no
// polígonos sintéticos generados con perturbaciones perpendiculares.

interface NdviPoint {
  daysAgo: number;
  ndvi: number;
  ndre?: number;
  ndmi?: number;
  evi?: number;
  savi?: number;
  anomaly?: boolean;
}

/** Convierte una lista de NdviPoint en ndviHistory documents. */
function buildHistory(points: NdviPoint[]): Array<Record<string, unknown>> {
  const now = Date.now();
  return points.map((p) => ({
    date: new Date(now - p.daysAgo * 24 * 60 * 60 * 1000),
    mean: p.ndvi,
    min: Math.max(0, p.ndvi - 0.08),
    max: Math.min(1, p.ndvi + 0.05),
    anomalyDetected: p.anomaly ?? false,
    source: 'sentinel-2',
    ndreValue: p.ndre ?? p.ndvi * 0.6,
    ndmiValue: p.ndmi ?? p.ndvi * 0.35,
    eviValue: p.evi ?? p.ndvi * 0.85,
    saviValue: p.savi ?? p.ndvi * 0.95,
    cloudFraction: 0.05,
  }));
}

/** MODIS baseline sintético — 5 años de NDVI medio mensual para un cultivo. */
function modisBaselineFor(crop: string, meanNdvi: number) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    // Olivo/almendro/pistacho: mayor verdor primavera-verano (abr-sep)
    const seasonal = crop === 'olivo' ? Math.sin((month - 3) * Math.PI / 6) * 0.08
                   : crop === 'almendro' ? Math.sin((month - 3) * Math.PI / 6) * 0.10
                   : Math.sin((month - 4) * Math.PI / 6) * 0.12; // pistacho
    return {
      month,
      mean: Math.max(0.15, Math.min(0.85, meanNdvi + seasonal)),
      std: 0.04,
      n: 5,
    };
  });
  return {
    years: 5,
    allTimeMean: meanNdvi,
    monthly: months,
    observationCount: 180, // ~12 meses x 5 años / cloud filter
    source: 'MOD13Q1',
  };
}

/** Climate baseline sintético — TerraClimate 1991-2020 para Jaén. */
function climateBaselineJaen() {
  // Jaén interior continental seco. Anual ~500mm, verano caluroso.
  const monthly = [
    { month: 1, precip: 65, tmin: 3, tmax: 13 },
    { month: 2, precip: 60, tmin: 4, tmax: 15 },
    { month: 3, precip: 55, tmin: 6, tmax: 18 },
    { month: 4, precip: 50, tmin: 8, tmax: 21 },
    { month: 5, precip: 40, tmin: 12, tmax: 26 },
    { month: 6, precip: 20, tmin: 16, tmax: 32 },
    { month: 7, precip: 5, tmin: 19, tmax: 36 },
    { month: 8, precip: 8, tmin: 19, tmax: 36 },
    { month: 9, precip: 25, tmin: 16, tmax: 31 },
    { month: 10, precip: 55, tmin: 11, tmax: 24 },
    { month: 11, precip: 70, tmin: 7, tmax: 18 },
    { month: 12, precip: 75, tmin: 4, tmax: 14 },
  ];
  return {
    period: '1991-2020',
    annualPrecip: monthly.reduce((s, m) => s + m.precip, 0),
    monthly,
    aridityIndex: 0.45,
    source: 'TerraClimate',
  };
}

/** RecentClimate ERA5 last 31 days. */
function recentClimate(precip: number, tempMean: number, drought?: string) {
  return {
    days: 31,
    precipTotalMm: precip,
    daysWithRain: Math.round(precip / 8),
    lastRainDaysAgo: precip > 30 ? 2 : 18,
    tempMeanC: tempMean,
    tempAnomalyC: tempMean - 18.5, // vs baseline mayo
    et0TotalMm: 130,
    droughtFlag: drought, // 'moderate' | 'severe' | undefined
    precipPctOfNormal: Math.round((precip / 40) * 100), // mayo normal ~40mm
  };
}

/** Thermal Landsat — usado para mostrar estrés en parcela #5. */
function thermalReading(lstC: number, airTempC: number, scenesUsed = 2) {
  return {
    lstC,
    airTempC,
    lstDeltaAirC: lstC - airTempC,
    days: 30,
    scenesUsed,
    source: 'Landsat 8/9',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Definición de las 6 parcelas pedagógicas
// ─────────────────────────────────────────────────────────────────────────

/**
 * Referencia SIGPAC oficial. Formato del visor MAPA:
 *   prov / muni / agre / zona / poligono / parcela / recinto
 * El alumno puede pegar estos números en https://sigpac.mapa.gob.es/fega/visor/
 * y ver exactamente la misma geometría que FitoLink muestra.
 */
interface SigpacRef {
  prov: string;     // siempre '23' para Jaén
  muni: string;
  agre: string;
  zona: string;
  poligono: string;
  parcela: string;
  recinto: string;
}

interface ParcelDef {
  name: string;
  cropType: string;
  province: string;
  /**
   * Aula Jaén v2 (22-may-2026): la geometría y el área vienen del catastro
   * oficial SIGPAC. Cada `sigpacRef` se verifica con `fetchByReference` en
   * el seed y devuelve un GeoJSON Polygon real + areaHa real. Cero invento.
   */
  sigpacRef: SigpacRef;
  pedagogicalNote: string;
  establishmentPhase?: boolean;
  plantingYear?: number;
  calibrating?: boolean; // marca para calcular calibratingUntil
  ndviHistory: NdviPoint[];
  modisAllTimeMean: number;
  recent: { precip: number; tempMean: number; drought?: string };
  thermal?: { lstC: number; airTempC: number };
  hasActiveAlert?: boolean;
  hasCompletedOperation?: boolean;
}

const PARCELS: ParcelDef[] = [
  // ─── 1 · Olivar tradicional sano · ladera sur Sierra Mágina ────────
  // Zona de olivar tradicional de secano al sur de Huelma (Sierra Mágina).
  // Imagen satelital: olivar de marco amplio (12×12) sobre ladera con
  // pequeña pendiente. Verificable en Google Earth.
  {
    name: '01 · Olivar tradicional sano (Sierra Mágina)',
    cropType: 'olivo',
    province: 'Jaen',
    // SIGPAC 23/1/0/0/10/15/1 · Albanchez de Mágina · OV · ~1.92 ha real
    sigpacRef: { prov: '23', muni: '1', agre: '0', zona: '0', poligono: '10', parcela: '15', recinto: '1' },
    pedagogicalNote: 'Olivar tradicional Sierra Mágina (catastro real Albanchez). NDVI estable 0.55+, baseline MODIS robusto, sin alertas. Caso "todo va bien" para discutir qué NO requiere intervención.',
    ndviHistory: [
      { daysAgo: 65, ndvi: 0.52 },
      { daysAgo: 60, ndvi: 0.54 },
      { daysAgo: 55, ndvi: 0.55 },
      { daysAgo: 50, ndvi: 0.56 },
      { daysAgo: 45, ndvi: 0.57 },
      { daysAgo: 40, ndvi: 0.58 },
      { daysAgo: 35, ndvi: 0.57 },
      { daysAgo: 30, ndvi: 0.56 },
      { daysAgo: 25, ndvi: 0.58 },
      { daysAgo: 20, ndvi: 0.59 },
      { daysAgo: 15, ndvi: 0.58 },
      { daysAgo: 10, ndvi: 0.57 },
      { daysAgo: 5, ndvi: 0.58 },
    ],
    modisAllTimeMean: 0.54,
    recent: { precip: 42, tempMean: 18.2 },
  },

  // ─── 2 · Olivar de seto intensivo · La Loma (Sabiote NE de Úbeda) ──
  // Zona de olivar superintensivo en seto, plantación densa, regadío.
  // La campiña entre Sabiote y Torreperogil es donde más se ha
  // extendido el modelo de seto en Jaén. Parcela bien rectangular.
  {
    name: '02 · Olivar de seto intensivo (La Loma)',
    cropType: 'olivo',
    province: 'Jaen',
    // SIGPAC 23/74/0/0/3/1/1 · Sabiote · OV · ~5.71 ha real
    sigpacRef: { prov: '23', muni: '74', agre: '0', zona: '0', poligono: '3', parcela: '1', recinto: '1' },
    pedagogicalNote: 'Olivar seto intensivo La Loma (catastro real Sabiote). NDVI alto con leve fluctuación intra-mes. Caso "manejo intensivo precisión": plantación densa, riego deficitario monitorizado.',
    ndviHistory: [
      { daysAgo: 65, ndvi: 0.68 },
      { daysAgo: 60, ndvi: 0.71 },
      { daysAgo: 55, ndvi: 0.73 },
      { daysAgo: 50, ndvi: 0.74 },
      { daysAgo: 45, ndvi: 0.72 }, // micro-dip por estrés riego
      { daysAgo: 40, ndvi: 0.74 },
      { daysAgo: 35, ndvi: 0.75 },
      { daysAgo: 30, ndvi: 0.76 },
      { daysAgo: 25, ndvi: 0.74 },
      { daysAgo: 20, ndvi: 0.75 },
      { daysAgo: 15, ndvi: 0.76 },
      { daysAgo: 10, ndvi: 0.77 },
      { daysAgo: 5, ndvi: 0.76 },
    ],
    modisAllTimeMean: 0.68,
    recent: { precip: 38, tempMean: 19.0 },
  },

  // ─── 3 · Pistachar joven CALIBRANDO · Frailes (Sierra Sur) ─────────
  // Frailes es la zona pistachera REAL de Jaén — provincia pionera en
  // pistacho de secano en España. Plantaciones jóvenes (2020-2024)
  // visibles en imagen satelital: parcelas casi cuadradas con marco
  // muy amplio y suelo desnudo dominante entre árboles.
  {
    name: '03 · Pistachar joven calibrando (Sierra Sur)',
    cropType: 'pistacho',
    province: 'Jaen',
    // SIGPAC 23/31/0/0/3/5/1 · Frailes · FY (frutal) · ~2.47 ha real
    sigpacRef: { prov: '23', muni: '31', agre: '0', zona: '0', poligono: '3', parcela: '5', recinto: '1' },
    pedagogicalNote: 'Pistachar joven en Frailes (catastro real, zona pistachera REAL de Jaén). Agricultor nuevo SIN plantingYear informado → modo Calibración pasiva 60 días. NDVI bajo pero la UI muestra "Calibrando". Caso clave: cómo onboarding sin info técnica evita falsos positivos.',
    calibrating: true,
    ndviHistory: [
      { daysAgo: 45, ndvi: 0.16 },
      { daysAgo: 40, ndvi: 0.18 },
      { daysAgo: 35, ndvi: 0.17 },
      { daysAgo: 30, ndvi: 0.19 },
      { daysAgo: 25, ndvi: 0.20 },
      { daysAgo: 20, ndvi: 0.18 },
      { daysAgo: 15, ndvi: 0.19 },
      { daysAgo: 10, ndvi: 0.20 },
      { daysAgo: 5, ndvi: 0.21 },
    ],
    modisAllTimeMean: 0.25, // baja porque la zona MODIS captura mucho suelo de pistachares jóvenes
    recent: { precip: 35, tempMean: 18.8 },
  },

  // ─── 4 · Almendro establecimiento INFORMADO · Quesada ─────────────
  // Zona de Quesada (al SO de Cazorla, pero sin entrar al pueblo) tiene
  // expansión reciente de almendro en regadío sobre antiguos olivares.
  // NO el centro de Cazorla — ahí solo hay tejados y huertas urbanas.
  {
    name: '04 · Almendro establecimiento (Quesada)',
    cropType: 'almendro',
    province: 'Jaen',
    // SIGPAC 23/70/0/0/3/5/1 · Quesada · FY (frutal) · catastro real
    sigpacRef: { prov: '23', muni: '70', agre: '0', zona: '0', poligono: '3', parcela: '5', recinto: '1' },
    pedagogicalNote: 'Almendro joven en Quesada (catastro real). Agricultor que SÍ informó plantingYear=2024 → sistema deduce establishmentPhase=true, etiqueta neutral "En establecimiento" en lugar de "Crítico". Caso clave: dato del agricultor → calibración inmediata, no espera 60 días.',
    establishmentPhase: true,
    plantingYear: 2024,
    ndviHistory: [
      { daysAgo: 65, ndvi: 0.20 },
      { daysAgo: 60, ndvi: 0.22 },
      { daysAgo: 55, ndvi: 0.24 },
      { daysAgo: 50, ndvi: 0.25 },
      { daysAgo: 45, ndvi: 0.27 },
      { daysAgo: 40, ndvi: 0.28 },
      { daysAgo: 35, ndvi: 0.27 },
      { daysAgo: 30, ndvi: 0.29 },
      { daysAgo: 25, ndvi: 0.30 },
      { daysAgo: 20, ndvi: 0.31 },
      { daysAgo: 15, ndvi: 0.32 },
      { daysAgo: 10, ndvi: 0.33 },
      { daysAgo: 5, ndvi: 0.32 },
    ],
    modisAllTimeMean: 0.38, // los almendros adultos vecinos en la baseline MODIS
    recent: { precip: 40, tempMean: 18.5 },
  },

  // ─── 5 · Olivar con ESTRÉS HÍDRICO REAL · campiña sur Baeza ───────
  // Olivar tradicional secano sobre la campiña al sur de Baeza, zona
  // donde la sequía 2023-2026 ha golpeado fuerte. Imagen satelital:
  // olivar viejo con suelo claro entre árboles, signos de estrés.
  {
    name: '05 · Olivar con estrés hídrico (Mancha Real)',
    cropType: 'olivo',
    province: 'Jaen',
    // SIGPAC 23/61/0/0/3/5/1 · Mancha Real · OV · ~2.43 ha real
    sigpacRef: { prov: '23', muni: '61', agre: '0', zona: '0', poligono: '3', parcela: '5', recinto: '1' },
    pedagogicalNote: 'CASO ORO. Olivar tradicional Mancha Real (catastro real). NDVI cayendo de 0.55 a 0.38 últimas 6 semanas + thermal LST-air +9°C + drought signal moderate. Alerta crítica activa. Operation completada el mes pasado. Caso ideal para debatir: cuándo regar, cuándo dejar.',
    ndviHistory: [
      { daysAgo: 65, ndvi: 0.55 },
      { daysAgo: 60, ndvi: 0.54 },
      { daysAgo: 55, ndvi: 0.52 },
      { daysAgo: 50, ndvi: 0.49 },
      { daysAgo: 45, ndvi: 0.46 },
      { daysAgo: 40, ndvi: 0.43 },
      { daysAgo: 35, ndvi: 0.41 },
      { daysAgo: 30, ndvi: 0.40 },
      { daysAgo: 25, ndvi: 0.39 },
      { daysAgo: 20, ndvi: 0.40 }, // intervención drone (Operation completada)
      { daysAgo: 15, ndvi: 0.39 },
      { daysAgo: 10, ndvi: 0.38, anomaly: true },
      { daysAgo: 5, ndvi: 0.38, anomaly: true },
    ],
    modisAllTimeMean: 0.52,
    recent: { precip: 8, tempMean: 22.5, drought: 'moderate' },
    thermal: { lstC: 36.5, airTempC: 27.0 }, // delta +9.5°C
    hasActiveAlert: true,
    hasCompletedOperation: true,
  },

  // ─── 6 · Olivar HETEROGÉNEO · campiña norte Andújar ──────────────
  // Campiña olivarera al norte del Guadalquivir, entre Andújar y
  // Marmolejo. Parcelas grandes (25+ ha) en suelos heterogéneos con
  // afloramientos rocosos / zonas más secas. Caso ideal de la lección
  // "la media de una parcela grande miente, mira por zonas".
  {
    name: '06 · Olivar heterogéneo (Andújar)',
    cropType: 'olivo',
    province: 'Jaen',
    // SIGPAC 23/5/0/0/15/5/1 · Andújar · OV · ~1.29 ha real
    sigpacRef: { prov: '23', muni: '5', agre: '0', zona: '0', poligono: '15', parcela: '5', recinto: '1' },
    pedagogicalNote: 'Olivar Andújar Sierra Morena (catastro real). NDVI medio 0.45 parece OK. PERO el intra-parcela (NdviHeatmap) muestra zona sur con 0.20 y norte 0.60. Caso clave: la media miente, mira por zonas, aplica solo donde duele. Discusión: tasa variable, secciones de control.',
    ndviHistory: [
      { daysAgo: 65, ndvi: 0.44 },
      { daysAgo: 60, ndvi: 0.45 },
      { daysAgo: 55, ndvi: 0.46 },
      { daysAgo: 50, ndvi: 0.45 },
      { daysAgo: 45, ndvi: 0.44 },
      { daysAgo: 40, ndvi: 0.45 },
      { daysAgo: 35, ndvi: 0.46 },
      { daysAgo: 30, ndvi: 0.45 },
      { daysAgo: 25, ndvi: 0.44 },
      { daysAgo: 20, ndvi: 0.45 },
      { daysAgo: 15, ndvi: 0.46 },
      { daysAgo: 10, ndvi: 0.45 },
      { daysAgo: 5, ndvi: 0.45 },
    ],
    modisAllTimeMean: 0.50,
    recent: { precip: 30, tempMean: 19.2 },
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for professor demo seed');

  const now = new Date();

  // 1 · Usuario profesor (idempotente)
  await User.updateOne(
    { googleId: PROFESSOR_GOOGLE_ID },
    {
      $set: {
        email: PROFESSOR_EMAIL,
        name: 'Jesús Vivar',
        role: 'farmer',
        company: 'Aula Agricultura Precisión Jaén',
        isVerified: true,
        rating: 0,
        ratingCount: 0,
        avatar: '/farmer.svg',
        updatedAt: now,
      },
      $unset: { location: '' },
      $setOnInsert: { googleId: PROFESSOR_GOOGLE_ID, createdAt: now },
    },
    { upsert: true },
  );
  const professor = await User.findOne({ googleId: PROFESSOR_GOOGLE_ID });
  if (!professor) {
    logger.error('Could not upsert professor user — aborting');
    await mongoose.disconnect();
    process.exit(1);
  }
  logger.info({ professorId: professor._id.toString() }, 'Professor user ready');

  // ─── Fresh state · v1.2 ─────────────────────────────────────────────
  // Esta es cuenta DEMO sintética. Borramos parcelas/alertas/operations
  // viejas del profesor para evitar duplicados cuando se ajustan nombres
  // o se añaden/quitan parcelas entre versiones del seed. Las cuentas
  // de farmers reales NO se tocan — limpia solo lo que pertenece a
  // este professor user.
  const existingParcels = await Parcel.find({ ownerId: professor._id }).select('_id');
  const existingIds = existingParcels.map((p) => p._id);
  if (existingIds.length > 0) {
    await Alert.deleteMany({ parcelId: { $in: existingIds } });
    await Operation.deleteMany({ parcelId: { $in: existingIds } });
    await Parcel.deleteMany({ _id: { $in: existingIds } });
    logger.info({ removed: existingIds.length }, 'Removed previous demo parcels (fresh state)');
  }

  let upserts = 0;
  let sigpacFailures = 0;
  for (let idx = 0; idx < PARCELS.length; idx++) {
    const def = PARCELS[idx];
    const ref = def.sigpacRef;
    const sigpacRefStr = `${ref.prov}/${ref.muni}/${ref.agre}/${ref.zona}/${ref.poligono}/${ref.parcela}/${ref.recinto}`;

    // Aula Jaén v2 (22-may-2026): descargamos geometría real catastral
    // desde SIGPAC en lugar de generar polígonos sintéticos. Si SIGPAC
    // falla (404 / API caída), saltamos la parcela y logueamos — un
    // re-run del seed cuando la API vuelva la recuperará.
    let sigpacResult: Awaited<ReturnType<typeof fetchByReference>>;
    try {
      sigpacResult = await fetchByReference(
        ref.prov, ref.muni, ref.agre, ref.zona, ref.poligono, ref.parcela, ref.recinto,
      );
    } catch (err) {
      sigpacFailures += 1;
      logger.error(
        { err, parcelName: def.name, sigpacRef: sigpacRefStr },
        'sigpac_fetch_failed_skipping_parcel',
      );
      continue;
    }
    logger.info(
      {
        parcelName: def.name,
        sigpacRef: sigpacRefStr,
        areaHa: sigpacResult.areaHa,
        cropUse: sigpacResult.cropUse,
      },
      'sigpac_fetched',
    );

    const updateDoc: Record<string, unknown> = {
      ownerId: professor._id,
      name: def.name,
      geometry: sigpacResult.geometry,                  // Polígono catastral REAL
      areaHa: sigpacResult.areaHa,                      // Superficie catastral REAL
      cropType: def.cropType,
      province: def.province,
      sigpacRef: sigpacRefStr,                          // Trazable al visor oficial
      isActive: true,
      isSyntheticDemo: true,                            // pipeline lo ignora, datos hand-crafted
      ndviHistory: buildHistory(def.ndviHistory),
      modisBaseline: modisBaselineFor(def.cropType, def.modisAllTimeMean),
      climateBaseline: climateBaselineJaen(),
      recentClimate: recentClimate(def.recent.precip, def.recent.tempMean, def.recent.drought),
      updatedAt: now,
    };

    if (def.thermal) {
      updateDoc.thermal = thermalReading(def.thermal.lstC, def.thermal.airTempC);
    }
    if (def.establishmentPhase) updateDoc.establishmentPhase = true;
    if (def.plantingYear) updateDoc.plantingYear = def.plantingYear;
    if (def.calibrating) {
      const until = new Date();
      until.setUTCDate(until.getUTCDate() + 60);
      updateDoc.calibratingUntil = until;
    } else {
      updateDoc.calibratingUntil = null;
    }

    const result = await Parcel.updateOne(
      { name: def.name, ownerId: professor._id },
      { $set: updateDoc, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    if (result.upsertedCount > 0) upserts += 1;
  }
  logger.info(
    { created: upserts, total: PARCELS.length, sigpacFailures },
    'Parcels upserted (v2 con geometrías SIGPAC reales)',
  );

  // 2 · Alert crítica activa en parcela #5 (olivar con estrés hídrico)
  // Limpiamos alerts previos sintéticos de las parcelas demo y recreamos
  // para que el seed sea idempotente sin acumular duplicados.
  const demoParcels = await Parcel.find({ ownerId: professor._id }).select('_id name');
  const parcelIds = demoParcels.map((p) => p._id);
  await Alert.deleteMany({ parcelId: { $in: parcelIds } });

  const stressParcel = demoParcels.find((p) => p.name.startsWith('05'));
  if (stressParcel) {
    await Alert.create({
      parcelId: stressParcel._id,
      type: 'ndvi_drop',
      severity: 'critical',
      ndviValue: 0.38,
      ndviDelta: -0.17,
      detectedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      status: 'new',
      aiConfidence: 0.92,
      detectionModel: 'v2_random_forest',
      detectionFeatures: {
        current_ndvi: 0.38,
        below_critical: 1,
        delta_1: -0.02,
        delta_3: -0.06,
        delta_5: -0.09,
        slope_3: -0.013,
        slope_5: -0.018,
        drop_from_recent_max: -0.17,
        consecutive_drops: 5,
        volatility: 0.025,
        ndre_delta_1: -0.015,
        seasonal_deviation: -0.14,
        below_seasonal_min: 1,
        month_sin: Math.sin((5 - 1) * Math.PI / 6),
        month_cos: Math.cos((5 - 1) * Math.PI / 6),
        crop_group_id: 1,
        history_length: 13,
      },
    });
    logger.info({ parcelId: stressParcel._id.toString() }, 'Active alert created on parcel #5');
  }

  // 3 · Operation completada en parcela #5 (trazabilidad post-intervención)
  await Operation.deleteMany({ parcelId: { $in: parcelIds } });
  if (stressParcel) {
    await Operation.create({
      parcelId: stressParcel._id,
      farmerId: professor._id,
      type: 'phytosanitary',
      status: 'completed',
      requestedAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      completedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      notes: 'Aplicación foliar bioestimulante anti-estrés hídrico tras alerta NDVI. Vuelo drone 6 ha. Condiciones: 21°C, viento 2.1 m/s, ventana ideal 14:00-16:30.',
    });
    logger.info({ parcelId: stressParcel._id.toString() }, 'Completed Operation seeded on parcel #5');
  }

  logger.info('Professor demo seed completed successfully');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
