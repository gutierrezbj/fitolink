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
 */
export function lowCoverNote(input: {
  parcelName?: string;
  cropType?: string;
  establishmentPhase?: boolean;
}): string {
  const where = input.parcelName ? `${input.parcelName} ` : '';
  const crop = cropLabel(input.cropType);
  if (input.establishmentPhase) {
    return `${where}está en fase de establecimiento. Los valores NDVI bajos son esperables hasta que el ${crop} complete la cobertura. Sin acción requerida.`;
  }
  return `${where}presenta cobertura vegetal baja (suelo predominantemente expuesto). Antes de actuar, conviene verificar si es la fase normal del ${crop} o si es estrés real.`;
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
