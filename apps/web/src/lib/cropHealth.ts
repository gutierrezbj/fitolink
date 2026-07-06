/**
 * NDVI CONSCIENTE DEL CULTIVO — umbrales de salud por tipo de cultivo Y MES.
 *
 * El porqué: el NDVI "normal" depende del cultivo y de la época. Un olivar de
 * SECANO vive en NDVI ~0.20–0.40 (árboles dispersos sobre suelo desnudo). Un
 * cultivo ANUAL (cereal, maíz) sube y baja con su ciclo: un cereal COSECHADO en
 * julio está a 0.10–0.22 (rastrojo) y eso es NORMAL, no crítico. La escala
 * genérica de cultivo denso/regadío (sano = 0.55, crítico < 0.30) pintaba de
 * "ROJO crítico" tanto el olivar como el cereal cosechado — falsos positivos.
 *
 * Solución: el umbral "saludable" es el MÍNIMO NORMAL del cultivo en el mes en
 * curso (mismos rangos estacionales que ParcelDetailPage.tsx y los floors del
 * backend). Así la GRÁFICA, el MAPA y la LISTA coinciden con el detalle y no son
 * alarmistas con anuales cosechados ni con olivar de secano.
 *
 * ⚠️ SEASONAL_RANGE está DUPLICADO en ParcelDetailPage.tsx (y como floors en
 * predictiveInsightService.ts). Mantener EN SYNC — TODO: centralizar.
 */

export interface NdviBands {
  /** ≥ healthy = verde "saludable". */
  healthy: number;
  /** ≥ attention = amarillo "atención". */
  attention: number;
  /** ≥ risk = naranja "riesgo"; por debajo = rojo "crítico". */
  risk: number;
}

// Escala densa genérica: cultivos de cobertura alta sin ciclo estacional
// definido aquí (fallback). Comportamiento previo para lo no mapeado.
const DENSE_BANDS: NdviBands = { healthy: 0.55, attention: 0.40, risk: 0.30 };

// Rangos estacionales [min_normal, max_normal] por mes (índice 0 = enero).
// COPIA EXACTA de ParcelDetailPage.tsx → mantener en sync.
const SEASONAL_RANGE: Record<string, [number, number][]> = {
  evergreen: [[0.32,0.62],[0.33,0.63],[0.35,0.65],[0.38,0.68],[0.40,0.70],[0.38,0.68],[0.35,0.65],[0.33,0.63],[0.34,0.64],[0.34,0.64],[0.32,0.62],[0.31,0.61]],
  olive: [[0.22,0.48],[0.24,0.50],[0.28,0.54],[0.30,0.56],[0.30,0.56],[0.25,0.52],[0.22,0.48],[0.22,0.46],[0.24,0.48],[0.28,0.52],[0.28,0.52],[0.25,0.50]],
  deciduous: [[0.08,0.25],[0.08,0.28],[0.10,0.35],[0.18,0.48],[0.38,0.65],[0.48,0.72],[0.52,0.75],[0.50,0.73],[0.42,0.68],[0.28,0.58],[0.12,0.35],[0.08,0.26]],
  winter_annual: [[0.22,0.50],[0.30,0.58],[0.40,0.68],[0.45,0.72],[0.30,0.62],[0.12,0.30],[0.10,0.22],[0.10,0.20],[0.12,0.25],[0.15,0.32],[0.18,0.40],[0.20,0.46]],
  summer_annual: [[0.08,0.20],[0.08,0.20],[0.10,0.22],[0.12,0.30],[0.22,0.48],[0.40,0.65],[0.48,0.72],[0.45,0.70],[0.30,0.60],[0.12,0.30],[0.08,0.22],[0.08,0.20]],
};

const CROP_GROUP: Record<string, keyof typeof SEASONAL_RANGE> = {
  olivo: 'olive', citrico: 'evergreen', almendro: 'deciduous', pistacho: 'deciduous',
  vinedo: 'deciduous', frutal: 'deciduous',
  cereal: 'winter_annual', leguminosa: 'winter_annual', remolacha: 'winter_annual', patata: 'winter_annual',
  girasol: 'summer_annual', maiz: 'summer_annual', algodon: 'summer_annual', arroz: 'summer_annual',
};

/**
 * Umbrales de salud del NDVI para un cultivo en un mes dado. Para cultivos con
 * ciclo estacional conocido, "saludable" = mínimo normal del mes (así un anual
 * cosechado no sale alarmista, pero un anual por debajo de su mínimo de
 * crecimiento sí). `month` 1–12; por defecto, el mes actual. Cultivos sin grupo
 * estacional → escala densa genérica.
 */
export function ndviBands(cropType?: string, month?: number): NdviBands {
  const group = cropType ? CROP_GROUP[cropType] : undefined;
  if (group) {
    const m = month ?? new Date().getMonth() + 1;
    const min = SEASONAL_RANGE[group][m - 1][0];
    return { healthy: min, attention: min * 0.8, risk: min * 0.6 };
  }
  return DENSE_BANDS;
}

const COLORS = {
  healthy: '#22c55e',
  attention: '#eab308',
  risk: '#f97316',
  critical: '#ef4444',
  none: '#94a3b8',
} as const;

/** Color (hex) del NDVI según los umbrales de su cultivo y mes. */
export function ndviColor(ndvi: number | null | undefined, cropType?: string, month?: number): string {
  if (ndvi == null) return COLORS.none;
  const b = ndviBands(cropType, month);
  if (ndvi >= b.healthy) return COLORS.healthy;
  if (ndvi >= b.attention) return COLORS.attention;
  if (ndvi >= b.risk) return COLORS.risk;
  return COLORS.critical;
}

/** Etiqueta de salud según los umbrales de su cultivo y mes. */
export function ndviHealthLabel(ndvi: number, cropType?: string, month?: number): string {
  const b = ndviBands(cropType, month);
  if (ndvi >= b.healthy) return 'Saludable';
  if (ndvi >= b.attention) return 'Atencion';
  if (ndvi >= b.risk) return 'Riesgo';
  return 'Critico';
}

/** ¿El NDVI está anómalamente bajo PARA SU CULTIVO y mes? (dispara el punto de alerta). */
export function ndviLowForCrop(ndvi: number | null | undefined, cropType?: string, month?: number): boolean {
  if (ndvi == null) return false;
  return ndvi < ndviBands(cropType, month).risk;
}
