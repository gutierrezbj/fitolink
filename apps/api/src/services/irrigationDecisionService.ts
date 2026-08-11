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
import { cropLabel, ndviStatusForCrop, type NdviStatus } from '@fitolink/shared';

// 'heat_watch' (12-jul-2026): el cultivo se ve BIEN pero hace calor / la
// demanda atmosférica es alta → aviso de CONTEXTO con tips, no una alarma de
// estrés. Nace del caso del maíz de regadío sano que recibía "RIEGO URGENTE".
export type IrrigationUrgency = 'urgent' | 'soon' | 'heat_watch' | 'monitor' | 'sufficient';

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
  /**
   * Tips accionables de verificación en campo. Filosofía "ojo en el cielo":
   * avisamos del contexto (calor, demanda), el agricultor confirma en tierra.
   * Vacío cuando no hay nada que vigilar.
   */
  tips: string[];
  /** Nota honesta de calor / demanda atmosférica (dato REAL de temperatura), o null. */
  heatContext: string | null;
  /**
   * Fecha de la última lectura satelital REAL (null si no hay ninguna). Es lo
   * que debe mostrarse como "última lectura" — NO `computedAt`, que es solo
   * cuándo se hizo este cálculo.
   */
  ndviLastReadingAt: Date | null;
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
 * Fecha de la ÚLTIMA lectura satelital utilizable. El banner mostraba
 * `computedAt` (= ahora) etiquetado como "última lectura": con nubes, la
 * última pasada útil puede ser de hace semanas y el agricultor leía una
 * frescura falsa. En un producto que vende "ojo en el cielo" eso es
 * inaceptable (fix 25-jul-2026 · CRITICAL_no_inventar).
 */
function latestNdviDate(parcel: IParcel): Date | null {
  const h = parcel.ndviHistory;
  if (!h || h.length === 0) return null;
  const d = h[h.length - 1]?.date;
  return d ? new Date(d) : null;
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
  // 'arena franca' (loamy sand) es arenoso pero no contiene el substring
  // 'arenoso' — sin esto caía al default de 4 días, más que un franco arenoso.
  if (t.includes('arenoso') || t.includes('arena')) return 2;
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
function phenologyNoteFor(cropType: string, now: Date, urgency: IrrigationUrgency): string | null {
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
  // Anuales de verano (maíz, girasol, algodón, arroz): sedientos POR DISEÑO
  // en su ventana estival. Una necesidad de riego alta en julio es NORMAL,
  // no un signo de estrés — clave para no dar falsas alarmas (12-jul-2026).
  // PERO si la urgencia YA señala estrés real (urgent/soon), la nota
  // tranquilizadora contradiría el aviso → se omite en esos casos.
  const reassuringOk = urgency !== 'urgent' && urgency !== 'soon';
  if (cropType === 'maiz' || cropType === 'girasol' || cropType === 'algodon' || cropType === 'arroz') {
    if (reassuringOk && month >= 5 && month <= 8) {
      return 'Cultivo de verano en plena demanda hídrica estival: una necesidad de riego alta es NORMAL y esperada en esta época, no un signo de estrés por sí sola.';
    }
  }
  // Cereal de invierno: en verano está en senescencia/cosecha, NDVI bajo normal.
  if (cropType === 'cereal') {
    if (reassuringOk && month >= 6 && month <= 8) {
      return 'El cereal de invierno está en senescencia o ya cosechado: un NDVI bajo en estos meses es normal (grano maduro o rastrojo), no estrés hídrico.';
    }
  }
  return null;
}

/**
 * Nivel de "calor / demanda atmosférica" a partir de la temperatura máxima
 * reciente (dato REAL medido, no estimado) y la ET0. Señal HONESTA para un
 * aviso de contexto (heads-up), NO un diagnóstico de estrés del cultivo.
 * Umbrales calibrados para verano peninsular.
 */
type HeatLevel = 'extreme' | 'high' | 'normal';
interface HeatSignal {
  level: HeatLevel;
  /** true si lo dispara la temperatura máxima real; false si solo la ET0 (demanda). */
  byTemp: boolean;
}
function heatSignalFrom(tempMaxC: number | null | undefined, et0PerDay: number): HeatSignal {
  const tMax = typeof tempMaxC === 'number' ? tempMaxC : null;
  const extreme = (tMax !== null && tMax >= 38) || et0PerDay >= 7;
  const high = (tMax !== null && tMax >= 33) || et0PerDay >= 6;
  const level: HeatLevel = extreme ? 'extreme' : high ? 'high' : 'normal';
  const byTemp = tMax !== null && tMax >= (level === 'extreme' ? 38 : 33);
  return { level, byTemp };
}

/**
 * Frase honesta del contexto de calor/demanda. Si lo dispara la temperatura
 * REAL medida, la nombra con la máxima; si solo lo dispara la ET0 (demanda
 * atmosférica estimada), NO imprime una temperatura que la desmienta.
 */
function heatPhrase(heat: HeatSignal, tMax: number | null): { inline: string; context: string } | null {
  if (heat.level === 'normal') return null;
  const word = heat.level === 'extreme' ? 'muy altas' : 'altas';
  if (heat.byTemp && tMax !== null) {
    return {
      inline: `temperaturas ${word} (máx. ~${Math.round(tMax)} °C)`,
      context: `Temperaturas recientes ${word} — máxima ~${Math.round(tMax)} °C`,
    };
  }
  return {
    inline: 'una demanda atmosférica alta',
    context: 'Demanda atmosférica (ET0) alta en los últimos días',
  };
}

/**
 * Fragmento de frase del NDVI coherente con su estado CROP-AWARE. Única
 * fuente del "cómo se nombra el NDVI" — así el titular (reason) nunca
 * contradice la narrativa (ambos salen de la misma semántica de estado).
 */
function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function ndviPhrase(ndvi: number | null, status: NdviStatus | null, cropName: string): string {
  if (ndvi === null) return `sin lectura NDVI reciente del ${cropName}`;
  const v = ndvi.toFixed(2);
  switch (status) {
    case 'healthy': return `NDVI ${v}, en rango normal para el ${cropName} en esta época`;
    case 'attention': return `NDVI ${v}, algo por debajo de lo típico para la época`;
    case 'risk': return `NDVI ${v}, por debajo de lo normal para el ${cropName}`;
    case 'critical': return `NDVI ${v}, bajo incluso para el ${cropName} en esta época`;
    default: return `NDVI ${v}`;
  }
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

  // 1. Estado actual del cultivo · CROP-AWARE (relativo a lo normal de ESE
  //    cultivo en ESTE mes, no a una escala fija de cultivo denso). Un maíz
  //    en julio y un olivo de secano no comparten "normal".
  if (ndviCurrent !== null) {
    const status = ndviStatusForCrop(ndviCurrent, parcel.cropType, new Date().getMonth() + 1);
    if (status === 'healthy') {
      parts.push(`El ${cropName} está en buen estado para la época (NDVI ${ndviCurrent.toFixed(2)}, dentro de lo normal para su cultivo y mes).`);
    } else if (status === 'attention') {
      parts.push(`El ${cropName} está algo por debajo de lo típico para la época (NDVI ${ndviCurrent.toFixed(2)}); conviene vigilar.`);
    } else if (status === 'risk') {
      parts.push(`El ${cropName} está por debajo de lo normal para su cultivo y mes (NDVI ${ndviCurrent.toFixed(2)}).`);
    } else {
      parts.push(`El ${cropName} muestra un NDVI ${ndviCurrent.toFixed(2)}, bajo incluso para su cultivo en esta época — conviene revisarlo en campo.`);
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

  // 5. Fenología por cultivo + mes (solo si aplica · coherente con la urgencia)
  const phenology = phenologyNoteFor(parcel.cropType, new Date(), urgency);
  if (phenology) {
    parts.push(phenology);
  }

  // 6. Establecimiento (cultivos jóvenes con calibración)
  if (parcel.establishmentPhase) {
    parts.push(`La parcela está en fase de establecimiento (primeros años post-plantación), demanda hídrica creciente.`);
  }

  // 7. Cierre operativo según urgencia · HONESTO (sin fingir certeza que el
  //    satélite no tiene: estima por balance, no mide humedad de suelo).
  if (urgency === 'urgent') {
    parts.push(`Señal compatible con falta de agua · conviene revisar la parcela y valorar riego. Es una estimación satélite+meteo; confírmalo en campo.`);
  } else if (urgency === 'soon') {
    parts.push(`Conviene una revisión antes de la próxima pasada satélite (≈ 5 días).`);
  } else if (urgency === 'heat_watch') {
    parts.push(`Con este calor conviene mantenerse atento y confirmar en campo (ver recomendaciones).`);
  } else if (urgency === 'monitor') {
    parts.push(`Sin urgencia · próxima evaluación tras nueva pasada Sentinel-2 en ~5 días.`);
  } else if (ndviCurrent === null) {
    // 'sufficient' sin lectura NDVI: el balance no señala déficit, pero NO
    // podemos afirmar que el cultivo "está en orden" sin verlo (no-inventar).
    parts.push(`El balance hídrico no señala déficit; a la espera de lectura NDVI para confirmar el estado del cultivo.`);
  } else {
    parts.push(`Sin acción inmediata · el cultivo y el balance hídrico están en orden.`);
  }

  return parts.join(' ');
}

/**
 * Calcula la decisión de riego completa para una parcela.
 */
export function computeIrrigationDecision(parcel: IParcel): IrrigationDecision {
  const ndviCurrent = latestNdvi(parcel);
  const ndviLastReadingAt = latestNdviDate(parcel);
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

  // ── Urgencia · CROP-AWARE (12-jul-2026) ────────────────────────────────
  //
  // Antes: 'urgent' se disparaba solo por NDVI absoluto < 0.30, igual para
  // maíz de regadío y olivo de secano → un maíz sano recibía "RIEGO URGENTE".
  // Ahora el estado del NDVI se juzga contra lo normal de ESE cultivo en ESE
  // mes (ndviStatusForCrop), 'urgent' exige además déficit hídrico REAL, y se
  // añade 'heat_watch': cultivo sano + calor alto → aviso de contexto + tips,
  // no alarma. Filosofía "ojo en el cielo": estimamos, el campo confirma.
  const month = new Date().getMonth() + 1;
  const cropName = cropLabel(parcel.cropType);
  const ndviStatus = ndviStatusForCrop(ndviCurrent, parcel.cropType, month); // null|healthy|attention|risk|critical
  const heat = heatSignalFrom(parcel.recentClimate?.tempMaxC, et0PerDay);
  const tMax = parcel.recentClimate?.tempMaxC ?? null;
  const heatText = heatPhrase(heat, tMax);
  const hasRealDeficit = deficitMm > 20; // hay falta de agua por balance, no solo NDVI
  const ndviLowForCrop = ndviStatus === 'critical' || ndviStatus === 'risk'; // por debajo de lo normal DE SU cultivo
  const ndviTxt = ndviPhrase(ndviCurrent, ndviStatus, cropName);

  let urgency: IrrigationUrgency;
  let recommendedAction: string;
  let reason: string;
  let alternative: string | null = null;
  let heatContext: string | null = null;

  if (ndviLowForCrop && hasRealDeficit) {
    // Estrés compatible con falta de agua: bajo para SU cultivo Y déficit real.
    urgency = 'urgent';
    recommendedAction = 'Posible estrés hídrico · revisar la parcela';
    reason = `${capitalize(ndviTxt)}, con déficit de ~${Math.round(deficitMm)} mm en 14 días. Señal compatible con falta de agua — conviene revisar en campo y valorar riego.`;
    alternative = 'Si ha regado o llovido estos días, la lectura satélite puede ir con retraso; reevaluar tras la próxima pasada.';
  } else if (ndviLowForCrop) {
    // NDVI bajo para su cultivo pero el balance NO señala falta de agua → NO
    // gritar riego. Puede ser fenología, plaga o suelo — a revisar en campo.
    urgency = 'soon';
    recommendedAction = 'NDVI bajo para el cultivo · revisar (no parece falta de agua)';
    reason = `${capitalize(ndviTxt)}, pero el balance hídrico no señala déficit (suelo + lluvia cubren la demanda). La causa probablemente no es el riego — conviene revisar la parcela en campo (fenología, plaga, suelo).`;
    if ((ndviTrend7d ?? 0) < -0.05) {
      alternative = `Además cae ${Math.abs(ndviTrend7d!).toFixed(2)} respecto a la lectura anterior: vigilar de cerca la evolución.`;
    }
  } else if (heat.level !== 'normal') {
    // ⭐ El caso del maíz: cultivo NO bajo para su tipo (sano/atención) o sin
    // lectura, + calor/demanda alta → aviso de contexto + tips, no alarma.
    urgency = 'heat_watch';
    recommendedAction = 'Atento por el calor · sin estrés detectado';
    const estado =
      ndviStatus === 'attention'
        ? `El ${cropName} está algo por debajo de lo típico para la época pero sin señal de estrés agudo`
        : ndviCurrent === null
        ? `No tenemos lectura NDVI reciente del ${cropName}`
        : `El ${cropName} está en buen estado por satélite, sin estrés`;
    reason = `${estado}. Con ${heatText!.inline}, la necesidad de riego sube: conviene estar atento y confirmar en campo.`;
    heatContext = `${heatText!.context} · ET del cultivo ~${Math.round(etCrop * 10) / 10} mm/día.`;
  } else if (deficitMm > 40) {
    urgency = 'monitor';
    recommendedAction = 'Vigilar · puede esperar 7-10 días';
    reason = `${ndviCurrent !== null ? `${capitalize(ndviTxt)}. ` : ''}Déficit acumulado ~${Math.round(deficitMm)} mm en 14 días, todavía dentro de la reserva utilizable del suelo.`;
    alternative = 'Programar riego ligero la próxima semana si no llueve.';
  } else {
    urgency = 'sufficient';
    recommendedAction = 'Sin necesidad de riego ahora';
    const deficitTxt = deficitMm > 20
      ? `Déficit leve ~${Math.round(deficitMm)} mm, cubierto por la reserva del suelo y la lluvia reciente.`
      : 'Suelo y lluvia reciente cubren la demanda. Sin déficit significativo.';
    reason = `${ndviCurrent !== null ? `${capitalize(ndviTxt)}. ` : ''}${deficitTxt}`;
  }

  // Tips accionables (ojo en el cielo → confirmar en tierra). Se muestran
  // siempre que haya algo que mirar; en 'sufficient' plenamente sano no hacen
  // falta, pero si el NDVI está 'attention' sí conviene el recordatorio.
  const tips: string[] = [];
  const somethingToWatch = urgency !== 'sufficient' || ndviStatus === 'attention';
  if (somethingToWatch) {
    tips.push('Revisa que tu sistema de riego esté operativo y sin fugas ni sectores tapados.');
    tips.push('Comprueba la humedad del suelo en campo (a mano o con sonda): la estimamos por satélite y meteo, no la medimos directamente.');
    if (heat.level !== 'normal') {
      tips.push('Con este calor, mantente atento a focos de fuego en parcelas colindantes.');
    }
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
    tips,
    heatContext,
    ndviLastReadingAt,
    computedAt: new Date(),
  };
}
