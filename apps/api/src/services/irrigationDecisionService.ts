/**
 * irrigationDecisionService · BUMM Regantes · 05-jun-2026.
 *
 * Convierte 7 cards técnicas (NDVI + suelo + clima + cultivo) en UNA
 * decisión de riego clara para un gerente de Comunidad de Regantes:
 *   · ¿Regar HOY, en 3-5 días, o puede esperar?
 *   · ¿Cuántos m³ aproximadamente?
 *   · ¿Cupo reducido tras RD 950/2024 (-20%)?
 *   · ¿Cuál sería la justificación agronómica?
 *
 * Lógica simplificada basada en FAO-56 (Penman-Monteith) pero sin
 * requerir ETo de fuentes externas — calculamos ET0 aproximada por
 * temperatura media y aplicamos Kc por cultivo. Suficiente para
 * recomendación operativa, no para ingeniería de regadío exacta.
 *
 * Inputs (todos ya en el modelo Parcel):
 *   · parcel.ndviHistory · estado del cultivo
 *   · parcel.soil · textura + cap. campo (SoilGrids)
 *   · parcel.recentClimate · precip + temp últimos 14d (ERA5)
 *   · parcel.cropType · Kc del cultivo
 *   · parcel.areaHa · superficie real catastral SIGPAC
 *
 * Output: estructura editorial vendible al gerente regantes.
 */

import type { IParcel } from '../models/Parcel.js';

export type IrrigationUrgency = 'urgent' | 'soon' | 'monitor' | 'sufficient';

export interface IrrigationDecision {
  urgency: IrrigationUrgency;
  recommendedAction: string; // titular editorial
  reason: string; // justificación agronómica
  ndviCurrent: number | null;
  ndviTrend7d: number | null;
  estimatedDeficitMm: number;
  estimatedCupoM3: number; // cupo libre
  cupoWithRd9502024M3: number; // -20% por la norma
  precipRecentMm: number;
  awcMm: number; // agua disponible útil del suelo
  etCropMmDay: number; // demanda diaria del cultivo
  alternative: string | null;
  computedAt: Date;
}

/**
 * Coeficiente Kc por cultivo (FAO-56 simplificado, valor medio del ciclo
 * vegetativo activo). Para Vega Baja del Segura mayo-junio, los cítricos
 * y frutales están en plena demanda hídrica.
 */
const KC_BY_CROP: Record<string, number> = {
  citrico: 0.75, // FAO-56 mid-season, cobertura suelo >50%
  olivo: 0.55, // olivar tradicional secano-regadío
  frutal: 0.85, // frutal de hueso en mid-season
  almendro: 0.7,
  hortaliza: 0.95, // hortícolas en pleno desarrollo
  vinedo: 0.45, // viñedo regadío deficitario
  cereal: 0.8,
  pistacho: 0.65,
  girasol: 0.85,
  algodon: 1.0,
  citricoLemon: 0.75,
  maiz: 1.05,
  remolacha: 1.0,
  patata: 1.1,
  leguminosa: 0.9,
  otro: 0.7,
};

/**
 * Última lectura NDVI o null si no hay history.
 */
function latestNdvi(parcel: IParcel): number | null {
  const h = parcel.ndviHistory;
  if (!h || h.length === 0) return null;
  return h[h.length - 1]?.mean ?? null;
}

/**
 * Tendencia NDVI últimos ~7-10 días (diferencia entre última lectura y la
 * anterior · cada lectura Sentinel-2 es cada ~5 días).
 */
function ndviTrend(parcel: IParcel): number | null {
  const h = parcel.ndviHistory;
  if (!h || h.length < 2) return null;
  const last = h[h.length - 1]?.mean;
  const prev = h[h.length - 2]?.mean;
  if (last === undefined || prev === undefined) return null;
  return last - prev;
}

/**
 * Capacidad agua disponible en el suelo (mm) sobre 30 cm efectivos.
 * Si tenemos `fieldCapacity` de SoilGrids (m³/m³), convertimos a mm.
 * Default conservador 60 mm para texturas medias sin datos.
 */
function availableWaterCapacityMm(parcel: IParcel): number {
  // SoilGrids fieldCapacityVol en m³/m³ (proporción volumétrica de agua a 33 kPa)
  // 1 m³/m³ × 0.30 m profundidad × 1000 (m→mm) = 300 mm máx teórico
  const fc = parcel.soil?.fieldCapacityVol;
  if (typeof fc === 'number' && fc > 0 && fc < 1) {
    return Math.round(fc * 300);
  }
  return 60;
}

/**
 * ET0 aproximada (mm/día) por temperatura media reciente. NO es Penman-
 * Monteith completo (no tenemos radiación neta · humedad · viento) pero
 * es coherente con el rango operativo levantino mayo-junio (5-7 mm/día).
 *
 * Fórmula de Hargreaves simplificada · clamp [2, 8] mm/día.
 */
function et0FromTemp(tempMeanC: number | undefined): number {
  const t = tempMeanC ?? 22;
  return Math.max(2, Math.min(8, 0.2 * t - 0.5));
}

/**
 * Calcula la decisión de riego completa para una parcela.
 */
export function computeIrrigationDecision(parcel: IParcel): IrrigationDecision {
  const ndviCurrent = latestNdvi(parcel);
  const ndviTrend7d = ndviTrend(parcel);

  const awcMm = availableWaterCapacityMm(parcel);
  const kc = KC_BY_CROP[parcel.cropType] ?? 0.7;
  const tempMean = parcel.recentClimate?.tempMeanC ?? null;
  // Si el pipeline ERA5 ya nos da ET0 total acumulada (mm), la usamos
  // directamente (mucho mejor que estimar por temperatura). Si no, caemos
  // al estimador Hargreaves simplificado.
  const climateWindowDays = parcel.recentClimate?.days ?? 14;
  const et0FromPipeline = parcel.recentClimate?.et0TotalMm;
  const et0PerDay =
    typeof et0FromPipeline === 'number' && et0FromPipeline > 0
      ? et0FromPipeline / Math.max(1, climateWindowDays)
      : et0FromTemp(tempMean ?? undefined);
  const etCrop = et0PerDay * kc;
  const precipRecent = parcel.recentClimate?.precipTotalMm ?? 0;

  // Ventana 14 días para acumular demanda vs oferta.
  // Demanda total = ET cultivo × días
  // Oferta = lluvia reciente efectiva (~80% de lo que cae es aprovechable) +
  //          50% de la reserva del suelo (el cultivo no usa toda)
  const windowDays = 14;
  const demandTotalMm = etCrop * windowDays;
  const supplyMm = precipRecent * 0.8 + awcMm * 0.5;
  const deficitMm = Math.max(0, demandTotalMm - supplyMm);

  // Cupo m³ = déficit_mm × área_ha × 10  (1 mm sobre 1 ha = 10 m³)
  const cupoM3 = Math.round(deficitMm * parcel.areaHa * 10);
  // RD 950/2024 obliga reducir 20% el consumo agua agraria. Mostramos
  // ambos · el cupo libre (para comparación histórica) + el reducido
  // (con la norma · es el que efectivamente puede aplicar).
  const cupoWithRd9502024 = Math.round(cupoM3 * 0.8);

  // Urgencia · combinación NDVI absoluto + tendencia + déficit
  let urgency: IrrigationUrgency;
  let recommendedAction: string;
  let reason: string;
  let alternative: string | null = null;

  if (ndviCurrent !== null && ndviCurrent < 0.3) {
    urgency = 'urgent';
    recommendedAction = 'RIEGO URGENTE · aplicar en 24-48 h';
    reason = `NDVI ${ndviCurrent.toFixed(2)} (crítico, < 0.30). El cultivo está en estrés agudo · cada día sin riego compromete la cosecha.`;
  } else if (
    ndviCurrent !== null &&
    ndviCurrent < 0.45 &&
    (ndviTrend7d ?? 0) < -0.05
  ) {
    urgency = 'soon';
    recommendedAction = 'Riego en los próximos 3-5 días';
    reason = `NDVI ${ndviCurrent.toFixed(2)} con caída de ${Math.abs(ndviTrend7d!).toFixed(2)} en última lectura. Si no se interviene entra en zona crítica antes del próximo paso satélite.`;
    alternative = 'Si llega lluvia > 15 mm en los próximos 4 días, aplazar 7 días y reevaluar.';
  } else if (deficitMm > 40) {
    urgency = 'monitor';
    recommendedAction = 'Vigilar · puede esperar 7-10 días';
    reason = `NDVI ${ndviCurrent !== null ? ndviCurrent.toFixed(2) : 'sin datos'} estable. Déficit hídrico acumulado de ~${Math.round(deficitMm)} mm en 14 días · todavía dentro de la reserva utilizable del suelo.`;
    alternative = 'Programar riego ligero la próxima semana si no llueve.';
  } else {
    urgency = 'sufficient';
    recommendedAction = 'NO requiere riego inmediato';
    reason = `NDVI ${ndviCurrent !== null ? ndviCurrent.toFixed(2) : 'sin datos'} adecuado y déficit moderado (~${Math.round(deficitMm)} mm). Suelo + lluvia reciente cubren la demanda del cultivo.`;
  }

  return {
    urgency,
    recommendedAction,
    reason,
    ndviCurrent,
    ndviTrend7d,
    estimatedDeficitMm: Math.round(deficitMm),
    estimatedCupoM3: cupoM3,
    cupoWithRd9502024M3: cupoWithRd9502024,
    precipRecentMm: Math.round(precipRecent),
    awcMm,
    etCropMmDay: Math.round(etCrop * 10) / 10,
    alternative,
    computedAt: new Date(),
  };
}
