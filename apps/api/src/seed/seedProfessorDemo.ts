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
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

const PROFESSOR_GOOGLE_ID = 'jesus-vivar-edu';
const PROFESSOR_EMAIL = 'jesusvivar22@gmail.com';

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * PRNG determinista (Mulberry32) — para perturbar los vértices del
 * polígono con randomness reproducible. Mismo seed = mismo polígono
 * en cada re-run del seed, así la parcela tiene una identidad estable.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Polígono IRREGULAR con N vértices (8 por defecto), escalado por área
 * real (ha), rotado y con perturbaciones deterministas por seed.
 *
 * Parcelas reales NO son rectángulos — siguen contornos de terreno,
 * caminos, lindes con vecinos. Este helper genera vértices distribuidos
 * sobre una elipse (rotada según orientación dominante de la parcela),
 * con cada vértice perturbado en radio (±15%) y ángulo (±0.075 rad)
 * de forma reproducible vía Mulberry32.
 *
 * Sustituye al `rotatedRect` anterior (rectángulo de 4 esquinas). Los
 * rectángulos perfectos no engañan al ojo de un profesor de precision ag.
 *
 *   · areaHa  → área real en hectáreas (1 ha = 10.000 m²)
 *   · rotDeg  → orientación dominante (eje largo) en grados desde N
 *   · aspect  → ratio largo/corto (1=redondo, 2=elipsoide 2:1)
 *   · seed    → entero que determina la forma irregular concreta
 */
function realisticPolygon(
  centerLng: number,
  centerLat: number,
  areaHa: number,
  rotDeg: number,
  aspect: number,
  seed: number,
): number[][] {
  const N_VERTICES = 8;
  const rand = mulberry32(seed * 100 + 7);

  // Semi-ejes de la elipse base: área = π·a·b, a/b = aspect
  // → a = √(area·aspect/π), b = √(area/(aspect·π))
  const areaM2 = areaHa * 10_000;
  const semiLongM = Math.sqrt((areaM2 * aspect) / Math.PI);
  const semiShortM = Math.sqrt(areaM2 / (aspect * Math.PI));

  // Conversión metros→grados (latitud corrige longitud por cos)
  const latRad = (centerLat * Math.PI) / 180;
  const mPerDegLng = 111_320 * Math.cos(latRad);
  const mPerDegLat = 110_540;
  const semiLongDeg = semiLongM / mPerDegLng;
  const semiShortDeg = semiShortM / mPerDegLat;

  const rotRad = (rotDeg * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  const ring: number[][] = [];
  for (let i = 0; i < N_VERTICES; i++) {
    // Ángulo base distribuido uniformemente alrededor del centroide
    const thetaBase = (i / N_VERTICES) * 2 * Math.PI;
    // Perturbación angular pequeña ±0.075 rad (~±4°)
    const thetaPerturb = (rand() - 0.5) * 0.15;
    const theta = thetaBase + thetaPerturb;
    // Perturbación radial 0.85-1.15 del radio base
    const radiusScale = 0.85 + rand() * 0.30;

    // Coordenadas locales sobre elipse (sin rotar)
    const xLocal = semiLongDeg * Math.cos(theta) * radiusScale;
    const yLocal = semiShortDeg * Math.sin(theta) * radiusScale;

    // Aplicar rotación
    const xRot = xLocal * cosR - yLocal * sinR;
    const yRot = xLocal * sinR + yLocal * cosR;

    ring.push([centerLng + xRot, centerLat + yRot]);
  }
  ring.push(ring[0]); // cerrar
  return ring;
}

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

interface ParcelDef {
  name: string;
  cropType: string;
  province: string;
  areaHa: number;
  /**
   * Centroide [lng, lat] elegido manualmente sobre IMAGEN SATELITAL REAL
   * de campos visibles de cada cultivo en Jaén. Verificable abriendo
   * Google Earth o el visor SIGPAC sobre la coordenada.
   */
  centroid: [number, number];
  /** Rotación del polígono en grados respecto al eje N. Olivares
   *  tradicionales en ladera suelen estar rotados 15-30°. */
  rotDeg: number;
  /** Ratio largo/ancho. 1 = cuadrado, 2 = elongado 2:1. Olivares 1.5-2,
   *  pistacho/almendro modernos cuadrados 1.0-1.2. */
  aspect: number;
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
    areaHa: 12.0,
    centroid: [-3.520, 37.620],   // S de Huelma, foothills despobladas
    rotDeg: 22,    // ladera orientada NO-SE
    aspect: 1.7,   // alargado siguiendo curva de nivel
    pedagogicalNote: 'Olivar de manual. NDVI estable 0.55+, baseline MODIS robusto, sin alertas. Caso "todo va bien" para discutir qué NO requiere intervención.',
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
    name: '02 · Olivar de seto intensivo (Úbeda)',
    cropType: 'olivo',
    province: 'Jaen',
    areaHa: 18.0,
    centroid: [-3.110, 38.116],   // E de Villacarrillo, heartland seto intensivo
    rotDeg: 8,     // casi N-S, parcela moderna mecanizada
    aspect: 1.6,
    pedagogicalNote: 'Olivar superintensivo en seto, plantación densa, riego deficitario monitorizado. NDVI muy alto 0.7+ con leve fluctuación intra-mes. Caso "manejo intensivo precisión".',
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
    areaHa: 8.0,
    centroid: [-3.870, 37.495],   // NE de Frailes, evita casco
    rotDeg: 12,
    aspect: 1.1,   // pistachar joven casi cuadrado
    pedagogicalNote: 'Agricultor nuevo SIN plantingYear informado. Sistema en modo Calibración pasiva 60 días. NDVI bajo pero la UI no grita: muestra "Calibrando". Caso clave: cómo onboarding sin info técnica del agricultor evita falsos positivos.',
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
    name: '04 · Almendro establecimiento (Cazorla)',
    cropType: 'almendro',
    province: 'Jaen',
    areaHa: 14.0,
    centroid: [-3.095, 37.815],   // S de Quesada, lejos de cualquier casco
    rotDeg: 5,
    aspect: 1.3,   // almendro moderno regadío, marco rectangular
    pedagogicalNote: 'Agricultor que SÍ informó plantingYear=2024 al alta. Sistema deduce establishmentPhase=true, etiqueta neutral "En establecimiento" en lugar de "Crítico". Caso clave: dato del agricultor → calibración inmediata, no espera 60 días.',
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
    name: '05 · Olivar con estrés hídrico (La Loma)',
    cropType: 'olivo',
    province: 'Jaen',
    areaHa: 6.0,
    centroid: [-3.510, 37.880],   // campiña entre Mancha Real y Begíjar
    rotDeg: 28,    // ladera campiña con desnivel
    aspect: 1.5,
    pedagogicalNote: 'CASO ORO. NDVI cayendo de 0.55 a 0.38 últimas 6 semanas + thermal LST-air +9°C + drought signal moderate. Alerta crítica activa. Operation completada el mes pasado (intervención previa con drone). Caso ideal para debatir: cuándo regar, cuándo dejar.',
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
    areaHa: 25.0,
    centroid: [-4.030, 38.105],   // N de Andújar, Sierra Morena foothills olive
    rotDeg: 15,
    aspect: 1.8,   // parcela grande alargada, típica campiña baja
    pedagogicalNote: 'NDVI medio 0.45, parece OK. PERO el intra-parcela (NdviHeatmap) muestra zona sur con 0.20 y norte 0.60. Caso clave para enseñar: la media miente, mira por zonas, aplica solo donde duele. Discusión: tasa variable, secciones de control.',
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
  for (let idx = 0; idx < PARCELS.length; idx++) {
    const def = PARCELS[idx];
    // Seed determinista por índice de parcela → cada parcela tiene su
    // identidad irregular estable entre re-runs del seed.
    const ring = realisticPolygon(
      def.centroid[0],
      def.centroid[1],
      def.areaHa,
      def.rotDeg,
      def.aspect,
      idx + 1,
    );

    const updateDoc: Record<string, unknown> = {
      ownerId: professor._id,
      name: def.name,
      geometry: { type: 'Polygon', coordinates: [ring] },
      areaHa: def.areaHa,
      cropType: def.cropType,
      province: def.province,
      isActive: true,
      isSyntheticDemo: true, // <-- el flag clave: pipeline lo ignora
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
  logger.info({ created: upserts, total: PARCELS.length }, 'Parcels upserted');

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
