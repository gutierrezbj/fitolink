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
import { cropLabel } from '@fitolink/shared';

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
  /**
   * Narrativa editorial generada server-side cruzando 6-8 variables
   * (NDVI + tendencia + cultivo + suelo + lluvia + fenología + estab.).
   * NO usa LLM · plantillas determinísticas, cero alucinación, coherente
   * con regla CRITICAL_no_inventar. Aporta contexto al gerente sin
   * que tenga que cruzar mentalmente todas las cards técnicas.
   */
  analysisNarrative: string;
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
 * Días aproximados que retiene agua un suelo según su textura dominante.
 * Basado en literatura agronómica para riego deficitario (no ingeniería
 * exacta · valor operativo para narrativa, no para cálculo de cupo).
 */
function retentionDaysByTexture(texture: string): number {
  const t = texture.toLowerCase();
  if (t.includes('arcilla') && !t.includes('arenosa') && !t.includes('limosa')) return 7;
  if (t.includes('franco arcilloso')) return 5;
  if (t.includes('arenoso')) return 2;
  if (t.includes('limoso')) return 5;
  if (t.includes('franco')) return 4;
  return 4; // default conservador
}

/**
 * Nota de fenología por cultivo y mes actual. Simple por diseño · solo
 * cubre los cultivos principales del catálogo FitoLink en sus fases
 * más críticas. Devuelve null si la fase no aplica (cultivo poco
 * crítico ese mes, mejor no decir nada que inventar).
 */
function phenologyNoteFor(cropType: string, now: Date): string | null {
  const month = now.getMonth(); // 0=enero
  if (cropType === 'citrico') {
    if (month >= 3 && month <= 5) return 'Los cítricos están en floración y cuajado, fase de máxima demanda hídrica.';
    if (month >= 6 && month <= 8) return 'En verano los cítricos están en crecimiento del fruto, etapa crítica para tamaño y calidad.';
  }
  if (cropType === 'frutal') {
    if (month >= 3 && month <= 5) return 'Fase de cuajado y crecimiento del fruto, alta sensibilidad al estrés hídrico.';
    if (month >= 6 && month <= 7) return 'Fase de crecimiento y maduración del fruto.';
  }
  if (cropType === 'olivo') {
    if (month >= 4 && month <= 5) return 'Floración y cuajado del olivar, etapa decisiva para la cosecha.';
    if (month >= 6 && month <= 8) return 'Endurecimiento del hueso y crecimiento del fruto.';
  }
  if (cropType === 'pistacho') {
    if (month >= 3 && month <= 5) return 'Brotación primaveral y cuajado del fruto en pistacho.';
  }
  if (cropType === 'almendro') {
    if (month >= 2 && month <= 4) return 'Cuajado y crecimiento del fruto en almendro.';
  }
  if (cropType === 'vinedo') {
    if (month >= 4 && month <= 5) return 'Floración y cuajado del viñedo, etapa decisiva.';
    if (month >= 6 && month <= 7) return 'Envero · cambio de color de la baya, crítico para calidad.';
  }
  return null;
}

/**
 * Genera la narrativa editorial server-side. Concatena 3-5 frases de
 * plantillas determinísticas alimentadas con datos reales del backend.
 * No es LLM. No alucina. No usa información que no esté en parcel o
 * decision. Coherente con CRITICAL_no_inventar.
 */
function composeNarrativeInsight(
  parcel: IParcel,
  ndviCurrent: number | null,
  ndviTrend7d: number | null,
  precipRecentMm: number,
  urgency: IrrigationUrgency,
): string {
  const parts: string[] = [];
  const cropName = cropLabel(parcel.cropType);

  // 1. Estado actual del cultivo (frase de entrada · siempre presente si hay NDVI)
  if (ndviCurrent !== null) {
    if (ndviCurrent >= 0.55) {
      parts.push(`El ${cropName} se encuentra en buen estado vegetativo (NDVI ${ndviCurrent.toFixed(2)}).`);
    } else if (ndviCurrent >= 0.45) {
      parts.push(`El ${cropName} mantiene un estado adecuado para la época (NDVI ${ndviCurrent.toFixed(2)}).`);
    } else if (ndviCurrent >= 0.3) {
      parts.push(`El ${cropName} muestra signos de estrés temprano (NDVI ${ndviCurrent.toFixed(2)}).`);
    } else {
      parts.push(`El ${cropName} está en estrés agudo (NDVI ${ndviCurrent.toFixed(2)}, zona crítica).`);
    }
  } else {
    parts.push(`Sin lecturas NDVI recientes para el ${cropName}. Esperando próxima pasada Sentinel-2.`);
  }

  // 2. Tendencia (solo si es relevante · no decimos "estable" salvo que el resto pida contexto)
  if (ndviTrend7d !== null) {
    if (ndviTrend7d < -0.05) {
      parts.push(`Caída notable respecto a la lectura anterior (${ndviTrend7d.toFixed(2)}), tendencia descendente clara.`);
    } else if (ndviTrend7d < -0.02) {
      parts.push(`Ligera caída en la última semana, vigilar evolución.`);
    } else if (ndviTrend7d > 0.03) {
      parts.push(`Tendencia ascendente respecto a lecturas previas, evolución positiva.`);
    }
  }

  // 3. Suelo · solo si tenemos textura
  if (parcel.soil?.dominantTexture) {
    const texture = parcel.soil.dominantTexture.toLowerCase();
    const retentionDays = retentionDaysByTexture(parcel.soil.dominantTexture);
    parts.push(`El suelo ${texture} retiene agua aproximadamente ${retentionDays} días tras lluvia significativa.`);
  }

  // 4. Lluvia reciente (siempre · es el dato base de la decisión)
  if (precipRecentMm < 5) {
    parts.push(`Apenas ha llovido en las últimas 2 semanas (${precipRecentMm} mm acumulados).`);
  } else if (precipRecentMm < 20) {
    parts.push(`Lluvia reciente escasa (${precipRecentMm} mm en 14 días), insuficiente para cubrir demanda.`);
  } else if (precipRecentMm < 40) {
    parts.push(`Lluvia reciente moderada (${precipRecentMm} mm en 14 días) cubre parte de la demanda.`);
  } else {
    parts.push(`Lluvia reciente abundante (${precipRecentMm} mm en 14 días) cubre la mayor parte de la demanda.`);
  }

  // 5. Fenología por cultivo + mes (solo si aplica)
  const phenology = phenologyNoteFor(parcel.cropType, new Date());
  if (phenology) {
    parts.push(phenology);
  }

  // 6. Establecimiento (cultivos jóvenes con calibración)
  if (parcel.establishmentPhase) {
    parts.push(`La parcela está en fase de establecimiento (primeros años post-plantación), demanda hídrica creciente.`);
  }

  // 7. Cierre operativo según urgencia
  if (urgency === 'urgent') {
    parts.push(`Acción inmediata recomendada para evitar pérdida de cosecha.`);
  } else if (urgency === 'soon') {
    parts.push(`Conviene programar intervención antes de la próxima pasada satélite (≈ 5 días).`);
  } else if (urgency === 'monitor') {
    parts.push(`Próxima evaluación tras nueva pasada Sentinel-2 en ~5 días.`);
  } else {
    parts.push(`No se requiere acción inmediata. Próxima evaluación tras nueva pasada Sentinel-2.`);
  }

  return parts.join(' ');
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

  const analysisNarrative = composeNarrativeInsight(
    parcel,
    ndviCurrent,
    ndviTrend7d,
    Math.round(precipRecent),
    urgency,
  );

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
    analysisNarrative,
    computedAt: new Date(),
  };
}
