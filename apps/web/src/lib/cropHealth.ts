/**
 * NDVI CONSCIENTE DEL CULTIVO — umbrales de salud por tipo de cultivo.
 *
 * El porqué: un olivar de SECANO vive estructuralmente en NDVI ~0.20–0.40
 * (árboles dispersos sobre suelo desnudo; el píxel del satélite promedia copa
 * verde + suelo marrón). La escala genérica de cultivo denso/regadío
 * (sano = 0.55, crítico < 0.30) pinta de "ROJO crítico" un olivar perfectamente
 * normal. El asesor del fondo lo cazó al instante en la reunión — la referencia
 * es lo que está mal, no el campo.
 *
 * Esto centraliza los umbrales para que la GRÁFICA, el MAPA y la LISTA coincidan
 * y no sean alarmistas con el olivar. Hermano de la lógica `seasonalNormal` ya
 * existente en el medidor de salud (Sprint no-alarmista 11-jun-2026).
 *
 * Por ahora SOLO el olivar cambia; el resto de cultivos mantiene la escala
 * genérica (no tocamos comportamiento no validado). Otros cultivos de secano
 * disperso (viñedo, almendro) se pueden añadir aquí cuando se validen.
 */

export interface NdviBands {
  /** ≥ healthy = verde "saludable". */
  healthy: number;
  /** ≥ attention = amarillo "atención". */
  attention: number;
  /** ≥ risk = naranja "riesgo"; por debajo = rojo "crítico". */
  risk: number;
}

const DENSE_BANDS: NdviBands = { healthy: 0.55, attention: 0.40, risk: 0.30 };
// Olivar de secano: copa dispersa + suelo desnudo → NDVI bajo es lo NORMAL.
// Envolvente derivada de los rangos estacionales validados (floor ~0.22).
const OLIVE_BANDS: NdviBands = { healthy: 0.22, attention: 0.15, risk: 0.09 };

const SPARSE_DRYLAND = new Set(['olivo']);

export function ndviBands(cropType?: string): NdviBands {
  return cropType && SPARSE_DRYLAND.has(cropType) ? OLIVE_BANDS : DENSE_BANDS;
}

const COLORS = {
  healthy: '#22c55e',
  attention: '#eab308',
  risk: '#f97316',
  critical: '#ef4444',
  none: '#94a3b8',
} as const;

/** Color (hex) del NDVI según los umbrales de su cultivo. */
export function ndviColor(ndvi: number | null | undefined, cropType?: string): string {
  if (ndvi == null) return COLORS.none;
  const b = ndviBands(cropType);
  if (ndvi >= b.healthy) return COLORS.healthy;
  if (ndvi >= b.attention) return COLORS.attention;
  if (ndvi >= b.risk) return COLORS.risk;
  return COLORS.critical;
}

/** Etiqueta de salud según los umbrales de su cultivo. */
export function ndviHealthLabel(ndvi: number, cropType?: string): string {
  const b = ndviBands(cropType);
  if (ndvi >= b.healthy) return 'Saludable';
  if (ndvi >= b.attention) return 'Atencion';
  if (ndvi >= b.risk) return 'Riesgo';
  return 'Critico';
}

/** ¿El NDVI está anómalamente bajo PARA SU CULTIVO? (dispara el punto de alerta). */
export function ndviLowForCrop(ndvi: number | null | undefined, cropType?: string): boolean {
  if (ndvi == null) return false;
  return ndvi < ndviBands(cropType).risk;
}
