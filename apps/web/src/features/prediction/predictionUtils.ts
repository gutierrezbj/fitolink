/**
 * Utilidades de la sección Predicción. Todo lo que aquí se calcula sale de la
 * serie REAL de la parcela (parcel.ndviHistory) — sin inventar nada.
 */

export interface NdviReading {
  date: string | Date;
  mean: number;
  min?: number;
  max?: number;
  anomalyDetected?: boolean;
  source?: string;
  ndreValue?: number;
  ndmiValue?: number;
}

/** Día del año (1–366). */
export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Trayectorias de envero (NDRE de otoño, sep–nov) agrupadas por año, pivotadas
 * sobre un eje común de día-del-año para dibujar una línea por campaña. Cada
 * fila lleva el `doy` y una clave `y<AÑO>` con el NDRE de ese año (resto null →
 * connectNulls salta). El motor del CUÁNDO lee justo esta curva.
 */
export function buildAutumnTrajectories(history: NdviReading[]): {
  years: number[];
  rows: Array<Record<string, number>>;
} {
  const autumn = history.filter((r) => {
    const m = new Date(r.date).getMonth() + 1;
    return m >= 9 && m <= 11 && r.ndreValue != null;
  });

  const byYear = new Map<number, number>();
  const rows: Array<Record<string, number>> = [];
  for (const r of autumn) {
    const d = new Date(r.date);
    const year = d.getFullYear();
    byYear.set(year, (byYear.get(year) ?? 0) + 1);
    rows.push({ doy: dayOfYear(d), [`y${year}`]: r.ndreValue as number });
  }

  // Solo años con ≥3 escenas de otoño cuentan como trayectoria legible.
  const years = [...byYear.entries()]
    .filter(([, n]) => n >= 3)
    .map(([y]) => y)
    .sort((a, b) => a - b);

  rows.sort((a, b) => a.doy - b.doy);
  return { years, rows };
}

/** Último nivel de envero observado (NDRE de otoño) — señal, no predicción. */
export function latestAutumnEnvero(
  history: NdviReading[],
): { level: number; year: number; n: number } | null {
  const autumn = history.filter((r) => {
    const m = new Date(r.date).getMonth() + 1;
    return m >= 9 && m <= 11 && r.ndreValue != null;
  });
  if (autumn.length < 3) return null;
  const last = autumn[autumn.length - 1];
  return {
    level: last.ndreValue as number,
    year: new Date(last.date).getFullYear(),
    n: autumn.length,
  };
}

/** Rango de fechas y nº de campañas (años distintos) de la serie. */
export function seriesSpan(history: NdviReading[]): {
  count: number;
  years: number;
  from: Date | null;
  to: Date | null;
} {
  if (!history.length) return { count: 0, years: 0, from: null, to: null };
  const dates = history.map((r) => new Date(r.date)).sort((a, b) => a.getTime() - b.getTime());
  const yearSet = new Set(dates.map((d) => d.getFullYear()));
  return { count: history.length, years: yearSet.size, from: dates[0], to: dates[dates.length - 1] };
}

/** Etiqueta de mes para los ticks del eje día-del-año (otoño). */
export const AUTUMN_TICKS = [244, 274, 305, 335];
export function autumnTickLabel(doy: number): string {
  if (doy < 259) return 'sep';
  if (doy < 290) return 'oct';
  if (doy < 320) return 'nov';
  return 'dic';
}

/** Paleta por campaña (coincide con los gráficos de marca del sandbox). */
export const CAMPAIGN_COLORS: Record<number, string> = {
  2022: '#c49032', // earth-400
  2023: '#9b6dbf', // violeta
  2024: '#46632e', // brand-600
  2025: '#d45220', // terra-500
  2026: '#3c7ab0', // azul
};
