/**
 * Crop coverage context — único responsable de interpretar SI tiene sentido
 * aplicar una regla absoluta (umbrales NDVI, badges de estrés, alertas de
 * diagnóstico) o si el cultivo está en una fase donde esa lectura sería
 * un falso positivo.
 *
 * Establecido tras incidente 13-may-2026: el badge "Estrés crítico" del
 * MpcContextWidget marcaba en rojo las 6 parcelas de pistacho en
 * establecimiento de Jonh, cuando el delta LST-aire de +15 °C era
 * simplemente suelo desnudo al sol en mayo, no estrés del cultivo.
 * Mismo síndrome detectado en otros 4 lugares (predictiveInsightService,
 * NdviForecastCard, dos diagnósticos textuales en ParcelDetailPage).
 *
 * Patrón: en cualquier sitio donde se aplique un umbral absoluto contra
 * NDVI o derivados, antes de etiquetar/alertar/avisar, llamar a
 * `inferCoverLevel()` para saber si la lectura es interpretable.
 */

/** Nivel de cobertura vegetal real del cultivo. */
export type CoverLevel =
  /** Suelo dominantemente expuesto. Reglas absolutas NO aplican. */
  | 'low'
  /** Cobertura parcial. Umbrales se relajan. */
  | 'partial'
  /** Cobertura completa. Reglas absolutas aplican normalmente. */
  | 'full';

export interface InferCoverInput {
  /** NDVI medio actual de la parcela. null si no hay lecturas todavía. */
  ndvi: number | null;
  /**
   * Flag manual en Parcel.establishmentPhase. true cuando la parcela está
   * recién plantada o sin cobertura completa por razones conocidas
   * (residual del cultivo anterior, pistachos jóvenes). Pisa al NDVI
   * porque el operador agronómico conoce el contexto real.
   */
  establishmentPhase?: boolean;
}

/**
 * Decide el nivel de cobertura vegetal a partir del NDVI actual y el
 * flag manual `establishmentPhase`. Llamar a este helper ANTES de
 * aplicar cualquier umbral absoluto que afecte mensajería al farmer.
 *
 * Umbrales usados (consistentes con los usados en el detector V2 y el
 * MpcContextWidget para mantener un único contrato):
 *   - establishmentPhase=true → siempre 'low'
 *   - ndvi < 0.30 → 'low'
 *   - 0.30 ≤ ndvi < 0.45 → 'partial'
 *   - ndvi ≥ 0.45 → 'full'
 *   - ndvi null → 'partial' (no asumimos lo peor sin datos)
 */
export function inferCoverLevel({ ndvi, establishmentPhase }: InferCoverInput): CoverLevel {
  if (establishmentPhase === true) return 'low';
  if (ndvi === null || ndvi === undefined) return 'partial';
  if (ndvi < 0.30) return 'low';
  if (ndvi < 0.45) return 'partial';
  return 'full';
}

/** Cultivos castellanos para mensajería contextual. */
const CROP_LABELS_ES: Record<string, string> = {
  olivo: 'olivar',
  vinedo: 'viñedo',
  pistacho: 'pistachar',
  almendro: 'almendro',
  cereal: 'cereal',
  citrico: 'cítrico',
  frutal: 'frutal',
  hortaliza: 'hortícola',
  girasol: 'girasol',
  maiz: 'maíz',
  algodon: 'algodón',
  arroz: 'arrozal',
  remolacha: 'remolacha',
  patata: 'patata',
  leguminosa: 'leguminosa',
};

export function cropLabel(cropType: string | undefined | null): string {
  if (!cropType) return 'cultivo';
  return CROP_LABELS_ES[cropType] ?? cropType;
}

/**
 * Mensajería Tipo A para una parcela en cobertura baja. Sustituye los
 * mensajes alarmistas absolutos por una explicación honesta del contexto.
 * Usado en NdviForecastCard, en el digest matutino, en alertas del
 * pipeline cuando hace falta suprimir un falso positivo.
 *
 * Sprint SoilGrids · C (22-may-2026) — cuando hay perfil edáfico (soil)
 * disponible, el mensaje se matiza según la textura dominante: arcillas
 * retienen agua y aguantan más sequía que arenas. El consejo accionable
 * cambia con la textura.
 */
export function lowCoverNote(input: {
  parcelName?: string;
  cropType?: string;
  establishmentPhase?: boolean;
  /** Perfil edáfico (Sprint SoilGrids C). Si presente, modula el mensaje. */
  soil?: {
    clayPct: number;
    sandPct: number;
    dominantTexture: string;
  } | null;
}): string {
  const where = input.parcelName ? `${input.parcelName} ` : '';
  const crop = cropLabel(input.cropType);

  // Sufijo edáfico — explica POR QUÉ esa parcela se comporta como se comporta,
  // dándole al agricultor info estructural que no cambia. Solo se añade si
  // hay perfil suelo y la textura es "interpretable" (no caso franco neutral).
  const soilSuffix = (() => {
    if (!input.soil) return '';
    const { clayPct, sandPct, dominantTexture } = input.soil;
    if (clayPct >= 35) {
      return ` Su suelo ${dominantTexture} (${clayPct.toFixed(0)}% arcilla) retiene agua varios días más que los suelos arenosos, así que el descenso será más lento pero el rebrote también lo será cuando llueva.`;
    }
    if (sandPct >= 65) {
      return ` Su suelo ${dominantTexture} (${sandPct.toFixed(0)}% arena) drena rápido — pierde humedad antes que un suelo arcilloso. Vigile la próxima ventana de lluvia o riego con atención.`;
    }
    return '';
  })();

  if (input.establishmentPhase) {
    return `${where}está en fase de establecimiento. Los valores NDVI bajos son esperables hasta que el ${crop} complete la cobertura. Sin acción requerida.${soilSuffix}`;
  }
  return `${where}presenta cobertura vegetal baja (suelo predominantemente expuesto). Antes de actuar, conviene verificar si es la fase normal del ${crop} o si es estrés real.${soilSuffix}`;
}

// ── NDVI consciente del cultivo Y el mes (fuente única de verdad) ─────────
//
// El NDVI "normal" depende del cultivo y de la época. Un olivar de SECANO vive
// en NDVI ~0.20–0.40 (árboles dispersos sobre suelo desnudo); un cultivo ANUAL
// (maíz, cereal) sube y baja con su ciclo. La escala densa genérica (sano 0.55,
// crítico <0.30) marcaba en rojo tanto el olivar como el maíz con la calle sin
// cerrar — falsos positivos. Aquí vive la ÚNICA copia de los rangos estacionales
// (antes duplicada en cropHealth.ts y ParcelDetailPage.tsx). Centralizado
// 12-jul-2026 para poder cablearla también al servicio de decisión de riego.

export interface NdviBands {
  /** ≥ healthy = verde "saludable" (mínimo normal del cultivo ese mes). */
  healthy: number;
  /** ≥ attention = amarillo "atención". */
  attention: number;
  /** ≥ risk = naranja "riesgo"; por debajo = rojo "crítico". */
  risk: number;
}

/** Escala densa genérica: cobertura alta sin ciclo estacional definido (fallback). */
const DENSE_BANDS: NdviBands = { healthy: 0.55, attention: 0.4, risk: 0.3 };

/** Rangos estacionales [min_normal, max_normal] por mes (índice 0 = enero). */
const SEASONAL_RANGE: Record<string, [number, number][]> = {
  evergreen: [[0.32,0.62],[0.33,0.63],[0.35,0.65],[0.38,0.68],[0.4,0.7],[0.38,0.68],[0.35,0.65],[0.33,0.63],[0.34,0.64],[0.34,0.64],[0.32,0.62],[0.31,0.61]],
  olive: [[0.22,0.48],[0.24,0.5],[0.28,0.54],[0.3,0.56],[0.3,0.56],[0.25,0.52],[0.22,0.48],[0.22,0.46],[0.24,0.48],[0.28,0.52],[0.28,0.52],[0.25,0.5]],
  deciduous: [[0.08,0.25],[0.08,0.28],[0.1,0.35],[0.18,0.48],[0.38,0.65],[0.48,0.72],[0.52,0.75],[0.5,0.73],[0.42,0.68],[0.28,0.58],[0.12,0.35],[0.08,0.26]],
  winter_annual: [[0.22,0.5],[0.3,0.58],[0.4,0.68],[0.45,0.72],[0.3,0.62],[0.12,0.3],[0.1,0.22],[0.1,0.2],[0.12,0.25],[0.15,0.32],[0.18,0.4],[0.2,0.46]],
  summer_annual: [[0.08,0.2],[0.08,0.2],[0.1,0.22],[0.12,0.3],[0.22,0.48],[0.4,0.65],[0.48,0.72],[0.45,0.7],[0.3,0.6],[0.12,0.3],[0.08,0.22],[0.08,0.2]],
};

const CROP_GROUP: Record<string, keyof typeof SEASONAL_RANGE> = {
  olivo: 'olive', citrico: 'evergreen', almendro: 'deciduous', pistacho: 'deciduous',
  vinedo: 'deciduous', frutal: 'deciduous',
  cereal: 'winter_annual', leguminosa: 'winter_annual', remolacha: 'winter_annual', patata: 'winter_annual',
  girasol: 'summer_annual', maiz: 'summer_annual', algodon: 'summer_annual', arroz: 'summer_annual',
};

/** ¿El cultivo es un anual de verano (maíz, girasol, algodón, arroz)? */
export function isSummerAnnual(cropType: string | undefined | null): boolean {
  return !!cropType && CROP_GROUP[cropType] === 'summer_annual';
}

/**
 * Umbrales de salud del NDVI para un cultivo en un mes dado. "Saludable" =
 * mínimo normal del mes para su ciclo. `month` 1–12 (por defecto, mes actual).
 * Cultivos sin grupo estacional → escala densa genérica.
 */
export function ndviBands(cropType?: string | null, month?: number): NdviBands {
  const group = cropType ? CROP_GROUP[cropType] : undefined;
  if (group) {
    const m = month ?? new Date().getMonth() + 1;
    const min = SEASONAL_RANGE[group][m - 1][0];
    return { healthy: min, attention: min * 0.8, risk: min * 0.6 };
  }
  return DENSE_BANDS;
}

/** Estado de salud del NDVI relativo a su cultivo y mes. */
export type NdviStatus = 'healthy' | 'attention' | 'risk' | 'critical';

export function ndviStatusForCrop(
  ndvi: number | null | undefined,
  cropType?: string | null,
  month?: number,
): NdviStatus | null {
  if (ndvi == null) return null;
  const b = ndviBands(cropType, month);
  if (ndvi >= b.healthy) return 'healthy';
  if (ndvi >= b.attention) return 'attention';
  if (ndvi >= b.risk) return 'risk';
  return 'critical';
}

/**
 * Años típicos en establecimiento por cultivo perenne. Consenso agronómico
 * conservador — preferimos asumir más años (menos falsos positivos de
 * alerta) que menos (más falsos positivos). Anuales no aparecen porque
 * no tienen fase de establecimiento — cada campaña empieza de cero.
 *
 * Usado al crear parcela: si plantingYear está informado y
 * (hoy - plantingYear) <= ESTABLISHMENT_YEARS[cropType] entonces el
 * sistema marca automáticamente establishmentPhase=true.
 */
export const ESTABLISHMENT_YEARS: Record<string, number> = {
  pistacho: 7,   // Plena producción 8º año
  olivo: 5,      // Olivo de seto: 3, tradicional: 7. Promedio 5.
  almendro: 4,
  citrico: 4,
  frutal: 4,
  vinedo: 3,
};

/** Período por defecto de calibración pasiva (sin plantingYear). */
export const CALIBRATION_DAYS = 60;

/**
 * Si plantingYear está informado, calcula si el cultivo está aún en
 * establecimiento según la tabla. Devuelve undefined si el cultivo no
 * es perenne o si plantingYear no está informado.
 */
export function inferEstablishmentFromAge(
  cropType: string | undefined | null,
  plantingYear: number | undefined | null,
  currentYear: number = new Date().getUTCFullYear(),
): boolean | undefined {
  if (!cropType || !plantingYear) return undefined;
  const yearsThreshold = ESTABLISHMENT_YEARS[cropType];
  if (yearsThreshold === undefined) return false; // cultivo anual, no aplica
  const age = currentYear - plantingYear;
  return age >= 0 && age < yearsThreshold;
}

/**
 * Devuelve true si la parcela está aún en período de calibración inicial
 * (sin plantingYear, sistema esperando suficientes lecturas para inferir
 * el estado del cultivo). Se usa para suavizar alertas y mensajería.
 */
export function isCalibrating(input: {
  calibratingUntil?: Date | string | null;
}): boolean {
  if (!input.calibratingUntil) return false;
  const until = input.calibratingUntil instanceof Date
    ? input.calibratingUntil
    : new Date(input.calibratingUntil);
  return until.getTime() > Date.now();
}

/** Días restantes de calibración (>= 0). 0 si ya terminó o no aplica. */
export function calibrationDaysLeft(input: {
  calibratingUntil?: Date | string | null;
}): number {
  if (!input.calibratingUntil) return 0;
  const until = input.calibratingUntil instanceof Date
    ? input.calibratingUntil
    : new Date(input.calibratingUntil);
  const ms = until.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
