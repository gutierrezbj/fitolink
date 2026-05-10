/**
 * Drone operation suitability calculator.
 *
 * Translates weather variables into a traffic-light verdict for a given
 * operation type. Rules are conservative, aligned with AESA + FAO drift
 * guidance for fitosanitary application and standard practice for
 * multispectral inspection. Tweak in one place if a customer demands a
 * different threshold.
 */
import type { HourlyForecast } from './openMeteo.js';

export type SuitabilityLevel = 'ideal' | 'ok' | 'caution' | 'forbidden';

export const SUITABILITY_STYLE: Record<SuitabilityLevel, { label: string; bg: string; text: string; ring: string; emoji: string }> = {
  ideal:     { label: 'Ideal',      bg: 'bg-green-50',  text: 'text-green-700',  ring: 'ring-green-200',  emoji: '✅' },
  ok:        { label: 'Aceptable',  bg: 'bg-lime-50',   text: 'text-lime-700',   ring: 'ring-lime-200',   emoji: '✅' },
  caution:   { label: 'Precaución', bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-200',  emoji: '⚠️' },
  forbidden: { label: 'No aplicar', bg: 'bg-red-50',    text: 'text-red-700',    ring: 'ring-red-200',    emoji: '🚫' },
};

export type OperationMode = 'phyto' | 'inspection';

export interface SuitabilityResult {
  level: SuitabilityLevel;
  reasons: string[];   // why this verdict — shown in tooltips/legends
}

/**
 * Fitosanitary application suitability (most restrictive — drift control).
 * Order matters: forbidden wins over caution wins over ok.
 */
function phytoSuitability(h: HourlyForecast, nextHoursPrecip: number): SuitabilityResult {
  const reasons: string[] = [];
  let level: SuitabilityLevel = 'ideal';

  // Wind sustained — primary drift factor (AESA + FAO)
  if (h.windSpeed > 5) {
    reasons.push(`viento ${h.windSpeed.toFixed(1)} m/s > 5`);
    level = 'forbidden';
  } else if (h.windSpeed > 3) {
    reasons.push(`viento ${h.windSpeed.toFixed(1)} m/s (3-5)`);
    if (level === 'ideal') level = 'caution';
  }

  // Gusts — sudden drift events
  if (h.windGusts > 7) {
    reasons.push(`ráfagas ${h.windGusts.toFixed(1)} m/s > 7`);
    level = 'forbidden';
  } else if (h.windGusts > 5) {
    reasons.push(`ráfagas ${h.windGusts.toFixed(1)} m/s (5-7)`);
    if (level !== 'forbidden') level = 'caution';
  }

  // Rain — washes off the product
  if (h.precip > 0.1 || h.precipProb > 60) {
    reasons.push(`lluvia ${h.precip.toFixed(1)} mm · ${h.precipProb}% prob`);
    level = 'forbidden';
  } else if (nextHoursPrecip > 0.5 || h.precipProb > 30) {
    reasons.push(`lluvia próximas h: ${nextHoursPrecip.toFixed(1)} mm`);
    if (level !== 'forbidden') level = 'caution';
  }

  // Temperature — efficacy + safety to crop
  if (h.temp < 5) {
    reasons.push(`temp ${h.temp.toFixed(0)}°C < 5`);
    level = 'forbidden';
  } else if (h.temp > 30) {
    reasons.push(`temp ${h.temp.toFixed(0)}°C > 30`);
    level = 'forbidden';
  } else if (h.temp > 25) {
    reasons.push(`temp ${h.temp.toFixed(0)}°C (25-30)`);
    if (level !== 'forbidden') level = 'caution';
  }

  // Humidity — drift increases with dry air
  if (h.humidity < 30) {
    reasons.push(`humedad ${h.humidity}% < 30 (deriva alta)`);
    if (level !== 'forbidden') level = 'caution';
  }

  // Promote ideal → ok if we have any non-zero reason (we technically passed but it's marginal)
  if (level === 'ideal' && reasons.length > 0) level = 'ok';

  return { level, reasons };
}

/**
 * Multispectral inspection — more permissive than spraying. Main concerns:
 * wind stability for sharp imagery, no rain, decent solar angle (we proxy
 * with cloud cover + time-of-day handled in the UI).
 */
function inspectionSuitability(h: HourlyForecast): SuitabilityResult {
  const reasons: string[] = [];
  let level: SuitabilityLevel = 'ideal';

  if (h.windSpeed > 10) {
    reasons.push(`viento ${h.windSpeed.toFixed(1)} m/s > 10`);
    level = 'forbidden';
  } else if (h.windSpeed > 7) {
    reasons.push(`viento ${h.windSpeed.toFixed(1)} m/s (7-10)`);
    if (level === 'ideal') level = 'caution';
  }

  if (h.windGusts > 12) {
    reasons.push(`ráfagas ${h.windGusts.toFixed(1)} m/s > 12`);
    level = 'forbidden';
  }

  if (h.precip > 0.05 || h.precipProb > 50) {
    reasons.push(`lluvia ${h.precip.toFixed(1)} mm · ${h.precipProb}%`);
    level = 'forbidden';
  }

  if (h.temp < 0 || h.temp > 40) {
    reasons.push(`temp ${h.temp.toFixed(0)}°C fuera de rango operación`);
    level = 'forbidden';
  }

  // Cloud cover degrades multispectral signal — caution if very overcast
  if (h.cloudCover > 80) {
    reasons.push(`nubosidad ${h.cloudCover}% > 80`);
    if (level !== 'forbidden') level = 'caution';
  }

  // Time-of-day handled in the UI (we mark 10-16h as the preferred window)

  if (level === 'ideal' && reasons.length > 0) level = 'ok';

  return { level, reasons };
}

/**
 * Score a single hour for the given operation mode. The caller supplies
 * `nextHoursPrecip` (sum over the next ~4 hours of forecast.precip) so we
 * can flag application even when it's dry NOW but rain is incoming.
 */
export function hourlySuitability(
  h: HourlyForecast,
  mode: OperationMode,
  nextHoursPrecip: number,
): SuitabilityResult {
  return mode === 'phyto'
    ? phytoSuitability(h, nextHoursPrecip)
    : inspectionSuitability(h);
}

/** Aggregate a day's worth of hourly verdicts into a single one. */
export function aggregateDay(verdicts: SuitabilityLevel[]): SuitabilityLevel {
  // Priority of "worst" for the day card glance
  if (verdicts.includes('ideal') || verdicts.includes('ok')) {
    // Has at least some viable window — show the best
    if (verdicts.includes('ideal')) return 'ideal';
    return 'ok';
  }
  if (verdicts.includes('caution')) return 'caution';
  return 'forbidden';
}

/** Count usable hours (ideal+ok) within working hours 8-18 of a day. */
export function workableHoursOfDay(
  hours: Array<{ time: string; level: SuitabilityLevel }>,
  date: string,
): number {
  return hours.filter((h) => {
    if (!h.time.startsWith(date)) return false;
    const hour = new Date(h.time).getHours();
    if (hour < 8 || hour > 18) return false;
    return h.level === 'ideal' || h.level === 'ok';
  }).length;
}
