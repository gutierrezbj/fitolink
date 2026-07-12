/**
 * NDVI CONSCIENTE DEL CULTIVO — colores/etiquetas de salud por cultivo Y MES.
 *
 * Los rangos estacionales (la lógica de "qué NDVI es normal para este cultivo
 * este mes") viven ahora en `@fitolink/shared` (cropContext.ts) como fuente
 * ÚNICA de verdad — antes estaban duplicados aquí y en ParcelDetailPage.tsx, y
 * el backend (irrigationDecisionService) no podía reutilizarlos. Centralizado
 * 12-jul-2026. Este módulo solo aporta la capa de PRESENTACIÓN (hex + labels),
 * que es específica del frontend.
 */

import { ndviBands, ndviStatusForCrop, type NdviBands } from '@fitolink/shared';

export { ndviBands };
export type { NdviBands };

const COLORS = {
  healthy: '#22c55e',
  attention: '#eab308',
  risk: '#f97316',
  critical: '#ef4444',
  none: '#94a3b8',
} as const;

/** Color (hex) del NDVI según los umbrales de su cultivo y mes. */
export function ndviColor(ndvi: number | null | undefined, cropType?: string, month?: number): string {
  const status = ndviStatusForCrop(ndvi, cropType, month);
  if (status === null) return COLORS.none;
  return COLORS[status];
}

/** Etiqueta de salud según los umbrales de su cultivo y mes. */
export function ndviHealthLabel(ndvi: number, cropType?: string, month?: number): string {
  const status = ndviStatusForCrop(ndvi, cropType, month);
  switch (status) {
    case 'healthy': return 'Saludable';
    case 'attention': return 'Atencion';
    case 'risk': return 'Riesgo';
    default: return 'Critico';
  }
}

/** ¿El NDVI está anómalamente bajo PARA SU CULTIVO y mes? (dispara el punto de alerta). */
export function ndviLowForCrop(ndvi: number | null | undefined, cropType?: string, month?: number): boolean {
  if (ndvi == null) return false;
  return ndvi < ndviBands(cropType, month).risk;
}
