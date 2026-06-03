import { Parcel, type INdviReading } from '../models/Parcel.js';
import { AppError } from '../utils/AppError.js';
import { inferCoverLevel, lowCoverNote, cropLabel, isCalibrating, calibrationDaysLeft } from '@fitolink/shared';

/**
 * Predictive insights — Ola 1.5 · Pieza 1.
 *
 * Turns the raw ndviHistory of a parcel into an actionable forecast:
 *   "tu Olivar Sierra Sur lleva 15 días en descenso. A este ritmo cruza
 *    el umbral crítico el 22 de mayo."
 *
 * No new model training, no satellite calls. Pure linear regression over
 * the parcel's own recent Sentinel-2 readings — cheap, transparent,
 * easy to explain to a farmer.
 *
 * Design choices:
 *   - We use only the last 5 readings (~25 days) for the slope so the
 *     trend reflects the *current* trajectory, not a 6-month average that
 *     can hide a recent collapse.
 *   - Confidence is gated by the number of points available, not by
 *     statistical fit. A perfectly linear trend over 3 points is still
 *     less trustworthy than a noisy trend over 5 points.
 *   - The "critical threshold" is the seasonal crop floor (looked up in
 *     the same table the detector uses), so an olivo in February has a
 *     different alarm line than a cereal in May.
 */

// Same per-crop seasonal floors used by feature_extractor.py in the
// pipeline. Mirrored here so the API doesn't need to load Python.
// (min_normal per month — falling below this enters the "alert" zone.)
const SEASONAL_FLOOR: Record<string, number[]> = {
  // Olivo, citrico, almendro (evergreen)
  evergreen: [0.32, 0.33, 0.35, 0.38, 0.40, 0.38, 0.35, 0.33, 0.34, 0.34, 0.32, 0.31],
  // Vinedo, frutal, pistacho, almendro caduco
  deciduous: [0.08, 0.08, 0.08, 0.08, 0.38, 0.48, 0.52, 0.50, 0.42, 0.28, 0.12, 0.08],
  // Cereal, leguminosa, remolacha, patata
  winter_annual: [0.22, 0.30, 0.40, 0.45, 0.30, 0.12, 0.10, 0.10, 0.12, 0.15, 0.18, 0.20],
  // Girasol, maiz, algodon, arroz
  summer_annual: [0.08, 0.08, 0.10, 0.12, 0.22, 0.40, 0.48, 0.45, 0.30, 0.12, 0.08, 0.08],
  other: Array(12).fill(0.20),
};

const CROP_TO_GROUP: Record<string, keyof typeof SEASONAL_FLOOR> = {
  olivo: 'evergreen',
  citrico: 'evergreen',
  almendro: 'deciduous',
  pistacho: 'deciduous',
  vinedo: 'deciduous',
  frutal: 'deciduous',
  cereal: 'winter_annual',
  leguminosa: 'winter_annual',
  remolacha: 'winter_annual',
  patata: 'winter_annual',
  girasol: 'summer_annual',
  maiz: 'summer_annual',
  algodon: 'summer_annual',
  arroz: 'summer_annual',
  hortaliza: 'other',
  otro: 'other',
};

function criticalFloorFor(cropType: string, month: number): number {
  const group = CROP_TO_GROUP[cropType] ?? 'other';
  // month is 1-12; array is 0-11
  return SEASONAL_FLOOR[group][month - 1] ?? 0.30;
}

// ── Public types ────────────────────────────────────────────────────────

export type ForecastTrend = 'descending' | 'ascending' | 'stable';
export type ForecastConfidence = 'high' | 'medium' | 'low' | 'none';

export interface NdviForecast {
  parcelId: string;
  parcelName: string;
  cropType: string;
  // Latest reading
  currentNdvi: number | null;
  currentNdviDate: string | null;
  // Trend computed over the last N readings (slope per day)
  trend: ForecastTrend;
  slopePerDay: number;        // negative = descending
  recentDelta: number;        // sum of the last 4 readings' deltas, for human reason text
  windowDays: number;         // calendar days spanned by the regression window
  // Projection
  criticalThreshold: number;  // the seasonal floor we're projecting against
  daysToCritical: number | null;  // null if not descending OR already below
  projectedCriticalDate: string | null;  // ISO yyyy-mm-dd
  alreadyCritical: boolean;
  // Meta
  confidence: ForecastConfidence;
  readingsUsed: number;
  // Spanish-language reason ready to drop into the morning digest
  message: string | null;
  // Crop context (Sprint contexto del cultivo, 13-may). El frontend usa este
  // flag para suprimir badges/pills alarmistas cuando alreadyCritical es
  // esperable (parcela en establecimiento). El message ya viene matizado;
  // este flag permite también atenuar la UI (color, tono).
  establishmentPhase: boolean;
  // Sprint Calibración del Cultivo · paso 4 (14-may). Cuando true, la
  // parcela está en modo Calibración pasiva (sin plantingYear informado al
  // alta, calibratingUntil > now). El message viene en formato suave
  // informativo, no proyectivo — el sistema aún no conoce el patrón
  // normal de la parcela para hacer una proyección honesta.
  calibrating: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Least-squares slope in NDVI units per day. Negative = descending. */
function linearSlopePerDay(points: { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxy += p.x * p.y;
    sxx += p.x * p.x;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return (n * sxy - sx * sy) / denom;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function spanishDate(d: Date): string {
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

// ── Core forecast ───────────────────────────────────────────────────────

const REGRESSION_WINDOW = 5;          // last N readings drive the slope
const MIN_FOR_FORECAST = 3;           // below this we just report current state
const STABLE_SLOPE_THRESHOLD = 0.001; // |slope| below this is "stable"

export function computeNdviForecast(parcel: {
  _id: { toString(): string };
  name: string;
  cropType: string;
  ndviHistory?: INdviReading[];
  /** Si true, la mensajería evita imputar alarmas a NDVI bajos esperables. */
  establishmentPhase?: boolean;
  /** Si activo (>now), la parcela está en modo Calibración pasiva. */
  calibratingUntil?: Date | string | null;
}): NdviForecast {
  const history = (parcel.ndviHistory ?? [])
    .filter((r) => typeof r.mean === 'number' && r.date)
    // Defensive sort: newest last
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const calibrating = isCalibrating({ calibratingUntil: parcel.calibratingUntil });

  const baseShape: NdviForecast = {
    parcelId: parcel._id.toString(),
    parcelName: parcel.name,
    cropType: parcel.cropType,
    currentNdvi: null,
    currentNdviDate: null,
    trend: 'stable',
    slopePerDay: 0,
    recentDelta: 0,
    windowDays: 0,
    criticalThreshold: criticalFloorFor(parcel.cropType, new Date().getMonth() + 1),
    daysToCritical: null,
    projectedCriticalDate: null,
    alreadyCritical: false,
    confidence: 'none',
    readingsUsed: history.length,
    message: null,
    establishmentPhase: parcel.establishmentPhase === true,
    calibrating,
  };

  // Sprint Calibración del Cultivo · paso 4 (14-may): cuando la parcela
  // está en modo Calibración pasiva, NO emitimos proyección crítica
  // absoluta — el sistema aún no conoce el patrón normal y un umbral
  // sería un falso positivo casi garantizado. El message va en formato
  // suave informativo, que el digest matutino renderiza sin alarma.
  if (calibrating) {
    const daysLeft = calibrationDaysLeft({ calibratingUntil: parcel.calibratingUntil });
    const where = parcel.name ? `${parcel.name} ` : '';
    return {
      ...baseShape,
      currentNdvi: history.length > 0 ? history[history.length - 1].mean : null,
      currentNdviDate: history.length > 0 ? isoDate(new Date(history[history.length - 1].date)) : null,
      message: `${where}sigue calibrándose. Faltan ${daysLeft} día${daysLeft === 1 ? '' : 's'} para que el sistema conozca el patrón normal de la parcela. Hasta entonces, recibirás los datos satelitales pero no alertas críticas.`,
    };
  }

  if (history.length === 0) {
    return { ...baseShape, message: 'Sin lecturas todavía. El pipeline procesa cada 5 días.' };
  }

  const latest = history[history.length - 1];
  const latestDate = new Date(latest.date);
  const currentNdvi = latest.mean;

  // Build regression window: last REGRESSION_WINDOW readings, x = days since
  // first reading in the window.
  const window = history.slice(-REGRESSION_WINDOW);
  const t0 = new Date(window[0].date).getTime();
  const points = window.map((r) => ({
    x: (new Date(r.date).getTime() - t0) / (24 * 60 * 60 * 1000),
    y: r.mean,
  }));
  const windowDays = points.length >= 2 ? points[points.length - 1].x : 0;
  const slope = linearSlopePerDay(points);

  // Recent delta — last reading vs the one 4 measurements ago (≈20 days).
  // Used for the human reason text, not for the projection.
  const recentDelta = history.length >= 5
    ? latest.mean - history[history.length - 5].mean
    : history.length >= 2
      ? latest.mean - history[0].mean
      : 0;

  // Trend classification
  let trend: ForecastTrend = 'stable';
  if (slope < -STABLE_SLOPE_THRESHOLD) trend = 'descending';
  else if (slope > STABLE_SLOPE_THRESHOLD) trend = 'ascending';

  // Critical floor for the parcel's crop in the *current* month
  const critical = criticalFloorFor(parcel.cropType, new Date().getMonth() + 1);
  const alreadyCritical = currentNdvi < critical;

  // Projection: only meaningful when descending and not already below
  let daysToCritical: number | null = null;
  let projectedCriticalDate: string | null = null;
  if (!alreadyCritical && trend === 'descending') {
    // (current - critical) / |slope| → days needed
    const days = (currentNdvi - critical) / -slope;
    // Cap at 60 days — beyond that the linear assumption breaks down
    if (Number.isFinite(days) && days > 0 && days <= 60) {
      daysToCritical = Math.round(days);
      const projDate = new Date(latestDate);
      projDate.setDate(projDate.getDate() + daysToCritical);
      projectedCriticalDate = isoDate(projDate);
    }
  }

  // Confidence gating
  let confidence: ForecastConfidence = 'none';
  if (history.length >= 5) confidence = 'high';
  else if (history.length >= 4) confidence = 'medium';
  else if (history.length >= MIN_FOR_FORECAST) confidence = 'low';

  // Compose the Spanish message (Tipo A friendly, no NDVI/NDRE jargon).
  //
  // Contexto del cultivo: antes de imputar "umbral cruzado" o "revisar en
  // persona", chequear cobertura vegetal real. Una parcela de pistachar
  // recién plantada cruza el umbral de cualquier modo — el mensaje
  // alarmista sería falso positivo. Mismo principio que el badge térmico
  // matizado del MpcContextWidget.
  const cover = inferCoverLevel({
    ndvi: currentNdvi,
    establishmentPhase: parcel.establishmentPhase,
  });

  let message: string | null = null;
  if (cover === 'low' && (alreadyCritical || trend === 'descending')) {
    // Cobertura baja por establecimiento o NDVI fisiológicamente bajo →
    // los umbrales absolutos no aplican. Mensaje neutro contextual.
    message = lowCoverNote({
      parcelName: parcel.name,
      cropType: parcel.cropType,
      establishmentPhase: parcel.establishmentPhase,
    });
  } else if (alreadyCritical) {
    message = `${parcel.name} está por debajo del umbral normal para el ${cropLabel(parcel.cropType)} en este mes. Revisar en persona o programar inspección dron.`;
  } else if (confidence === 'none' || confidence === 'low') {
    message = `Aún pocas lecturas para proyectar tendencia (${history.length}). Disponible a partir de la 4ª lectura del pipeline.`;
  } else if (trend === 'descending' && projectedCriticalDate) {
    const projDate = new Date(projectedCriticalDate);
    message = `${parcel.name} lleva tendencia descendente. Si se mantiene, entra en zona delicada el ${spanishDate(projDate)}.`;
  } else if (trend === 'descending') {
    message = `${parcel.name} desciende suave; sin cruce de umbral previsto en los próximos 60 días.`;
  } else if (trend === 'ascending') {
    message = `${parcel.name} en mejora — recuperando vigor respecto a la última quincena.`;
  } else {
    message = `${parcel.name} estable, dentro del rango habitual para el ${cropLabel(parcel.cropType)} en este mes.`;
  }

  return {
    ...baseShape,
    currentNdvi,
    currentNdviDate: isoDate(latestDate),
    trend,
    slopePerDay: Number(slope.toFixed(6)),
    recentDelta: Number(recentDelta.toFixed(3)),
    windowDays: Math.round(windowDays),
    criticalThreshold: critical,
    daysToCritical,
    projectedCriticalDate,
    alreadyCritical,
    confidence,
    readingsUsed: points.length,
    message,
  };
}

// ── Service entry point ─────────────────────────────────────────────────

/**
 * Compute the forecast for a single parcel. Used by the GET endpoint and
 * (later) by the morning-digest cron.
 */
export async function getNdviForecastForParcel(parcelId: string): Promise<NdviForecast> {
  const parcel = await Parcel.findById(parcelId)
    .select('_id name cropType ndviHistory establishmentPhase calibratingUntil')
    .lean();
  if (!parcel) throw AppError.notFound('Parcela');
  return computeNdviForecast(parcel as Parameters<typeof computeNdviForecast>[0]);
}

/**
 * Compute forecasts for every active parcel of a user — entry point for
 * the morning-digest assembler (Ola 1.5 Pieza 1 ↔ Pieza 4).
 */
export async function getNdviForecastsForOwner(ownerId: string): Promise<NdviForecast[]> {
  const parcels = await Parcel.find({ ownerId, isActive: true })
    .select('_id name cropType ndviHistory establishmentPhase calibratingUntil')
    .lean();
  return parcels.map((p) =>
    computeNdviForecast(p as Parameters<typeof computeNdviForecast>[0]),
  );
}
