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
