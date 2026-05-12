import { Parcel } from '../models/Parcel.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { polygonCentroid } from '../utils/geo.js';

/**
 * Predictive insights — Ola 1.5 · Pieza 2.
 *
 * Reads the next 7 days of Open-Meteo forecast for a parcel and applies
 * seven explicit weather rules (cold front, warm front, storm, low
 * pressure, frost, extreme heat, high wind) to produce ready-to-send
 * messages in Tipo A friendly Spanish. The morning digest will pick the
 * most urgent 1-2 events per parcel; the parcel detail view shows all of
 * them in chronological order.
 *
 * Open-Meteo is hit directly here (the same public endpoint the frontend
 * weather widget uses). No API key, CORS-open, free up to 10k req/day.
 * If Open-Meteo ever rate-limits we add a small server-side cache, but
 * for the wedge phase this is plenty.
 */

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

// ── Open-Meteo types (subset — only what the rules need) ────────────────

interface DailyRaw {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: (number | null)[];
  windspeed_10m_max: number[];
  windgusts_10m_max: number[];
  relative_humidity_2m_max: (number | null)[];
  relative_humidity_2m_min: (number | null)[];
  weathercode: number[];
}

interface ForecastRaw {
  latitude: number;
  longitude: number;
  timezone: string;
  daily: DailyRaw;
}

// ── Public types ────────────────────────────────────────────────────────

export type WeatherEventType =
  | 'cold_front'
  | 'warm_front'
  | 'storm'
  | 'low_pressure'
  | 'frost'
  | 'extreme_heat'
  | 'high_wind';

export type WeatherEventSeverity = 'info' | 'warning' | 'alert';

export interface WeatherEvent {
  type: WeatherEventType;
  severity: WeatherEventSeverity;
  /** ISO yyyy-mm-dd of the impact day (start day if multi-day) */
  date: string;
  /** Human label in Spanish ("mañana", "el viernes", "el 17 de mayo") */
  dayLabel: string;
  /** Ready-to-send message in Tipo A friendly Spanish */
  message: string;
  /** Raw values that triggered the rule (kept for tooltip / debug) */
  data: Record<string, number | null>;
}

export interface WeatherEventsResponse {
  parcelId: string;
  parcelName: string;
  latitude: number;
  longitude: number;
  fetchedAt: string;
  events: WeatherEvent[];
}

// ── Spanish day labels ──────────────────────────────────────────────────

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function dayLabelFor(isoDate: string, today: Date = new Date()): string {
  const target = new Date(isoDate + 'T12:00:00');
  const t0 = new Date(today);
  t0.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  const diffDays = Math.round((t.getTime() - t0.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'mañana';
  if (diffDays === 2) return 'pasado mañana';
  if (diffDays > 0 && diffDays < 7) return `el ${WEEKDAYS[target.getDay()]}`;
  return `el ${target.getDate()} de ${MONTHS[target.getMonth()]}`;
}

function sevSpanish(s: WeatherEventSeverity): string {
  return s === 'alert' ? 'crítica' : s === 'warning' ? 'aviso' : 'informativa';
}

// ── The 7 rules ─────────────────────────────────────────────────────────

function detectEvents(d: DailyRaw, parcelName: string, today: Date): WeatherEvent[] {
  const events: WeatherEvent[] = [];
  const n = d.time.length;

  // Helpers
  const isStormCode = (code: number) => code >= 95 && code <= 99;
  const round = (v: number | null, dec = 1) => (v == null ? null : Number(v.toFixed(dec)));

  for (let i = 0; i < n; i++) {
    const date = d.time[i];
    const label = dayLabelFor(date, today);
    const tmax = d.temperature_2m_max[i];
    const tmin = d.temperature_2m_min[i];
    const precip = d.precipitation_sum[i];
    const wind = d.windspeed_10m_max[i];
    const gusts = d.windgusts_10m_max[i];
    const hmin = d.relative_humidity_2m_min[i];
    const code = d.weathercode[i];

    // RULE 1 — Cold front: tempMin drops > 5°C vs previous day
    if (i > 0) {
      const dt = tmin - d.temperature_2m_min[i - 1];
      if (dt <= -5) {
        events.push({
          type: 'cold_front',
          severity: 'warning',
          date,
          dayLabel: label,
          message: `${label.charAt(0).toUpperCase() + label.slice(1)} baja la mínima de ${round(d.temperature_2m_min[i - 1])}° a ${round(tmin)}°. Si tiene frutal o viña en floración, ojo a las heladas tardías.`,
          data: { tmin: round(tmin), tmin_prev: round(d.temperature_2m_min[i - 1]), delta: round(dt) },
        });
      }
    }

    // RULE 2 — Warm front: tempMax rises > 5°C + humedad < 40%
    if (i > 0) {
      const dt = tmax - d.temperature_2m_max[i - 1];
      if (dt >= 5 && hmin != null && hmin < 40) {
        events.push({
          type: 'warm_front',
          severity: 'warning',
          date,
          dayLabel: label,
          message: `${label.charAt(0).toUpperCase() + label.slice(1)} sube la máxima a ${round(tmax)}° con aire seco (${round(hmin, 0)}% humedad). Riegue antes y evite aplicar al mediodía.`,
          data: { tmax: round(tmax), tmax_prev: round(d.temperature_2m_max[i - 1]), humidity_min: hmin },
        });
      }
    }

    // RULE 3 — Storm (weathercode 95-99)
    if (isStormCode(code)) {
      events.push({
        type: 'storm',
        severity: 'alert',
        date,
        dayLabel: label,
        message: `Tormenta prevista ${label} en su zona. Adelante cualquier aplicación pendiente al día anterior o programe para después.`,
        data: { weather_code: code, precip_mm: round(precip) },
      });
    }

    // RULE 5 — Frost: tempMin < 2°C
    if (tmin != null && tmin < 2) {
      events.push({
        type: 'frost',
        severity: 'alert',
        date,
        dayLabel: label,
        message: `Posible helada ${label} (mínima ${round(tmin)}°). Proteja lo que tenga en floración o brotación.`,
        data: { tmin: round(tmin) },
      });
    }

    // RULE 6 — Extreme heat: tempMax > 35°C
    if (tmax != null && tmax > 35) {
      events.push({
        type: 'extreme_heat',
        severity: 'alert',
        date,
        dayLabel: label,
        message: `Calor extremo ${label} (${round(tmax)}°). Estrés hídrico fuerte garantizado, prepare riego de auxilio.`,
        data: { tmax: round(tmax) },
      });
    }

    // RULE 7 — High wind: gusts > 12 m/s (≈43 km/h)
    if (gusts != null && gusts > 12) {
      events.push({
        type: 'high_wind',
        severity: 'warning',
        date,
        dayLabel: label,
        message: `${label.charAt(0).toUpperCase() + label.slice(1)} ventoso (ráfagas hasta ${round(gusts * 3.6, 0)} km/h). No habrá ventana drone — no programe aplicación.`,
        data: { wind_speed_max: round(wind), wind_gusts_max: round(gusts) },
      });
    }
  }

  // RULE 4 — Low pressure window: precip accumulated over any 3-day sliding
  // window exceeds 30 mm. We emit a single event anchored at the start day.
  for (let i = 0; i + 2 < n; i++) {
    const window3 = d.precipitation_sum[i] + d.precipitation_sum[i + 1] + d.precipitation_sum[i + 2];
    if (window3 > 30) {
      const date = d.time[i];
      const label = dayLabelFor(date, today);
      events.push({
        type: 'low_pressure',
        severity: 'warning',
        date,
        dayLabel: label,
        message: `Llegan ${round(window3, 0)} mm de lluvia entre ${label} y los dos días siguientes. Sus parcelas pasarán a saturadas; sin ventana drone hasta que escampe.`,
        data: { precip_3d_mm: round(window3, 1) },
      });
      // Skip ahead to avoid emitting overlapping windows for the same rainfall
      i += 2;
    }
  }

  // Sort by date ascending, severity descending within same date
  const sevOrder: Record<WeatherEventSeverity, number> = { alert: 0, warning: 1, info: 2 };
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return sevOrder[a.severity] - sevOrder[b.severity];
  });

  // Dedupe: a single (type, date) only emitted once
  const seen = new Set<string>();
  const deduped: WeatherEvent[] = [];
  for (const ev of events) {
    const key = `${ev.type}:${ev.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ev);
  }

  return deduped;
}

// ── Open-Meteo fetch ────────────────────────────────────────────────────

async function fetchForecast(lat: number, lon: number): Promise<ForecastRaw> {
  const daily = [
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_sum',
    'precipitation_probability_max',
    'windspeed_10m_max',
    'windgusts_10m_max',
    'relative_humidity_2m_max',
    'relative_humidity_2m_min',
    'weathercode',
  ].join(',');

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily,
    timezone: 'auto',
    forecast_days: '7',
    windspeed_unit: 'ms',
  });

  const res = await fetch(`${OPEN_METEO_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }
  return (await res.json()) as ForecastRaw;
}

// ── Service entry point ─────────────────────────────────────────────────

export async function getWeatherEventsForParcel(parcelId: string): Promise<WeatherEventsResponse> {
  const parcel = await Parcel.findById(parcelId)
    .select('_id name geometry')
    .lean();
  if (!parcel) throw AppError.notFound('Parcela');

  const [lon, lat] = polygonCentroid(parcel.geometry as { type: 'Polygon'; coordinates: number[][][] });

  try {
    const raw = await fetchForecast(lat, lon);
    const events = detectEvents(raw.daily, parcel.name, new Date());
    return {
      parcelId: parcel._id.toString(),
      parcelName: parcel.name,
      latitude: lat,
      longitude: lon,
      fetchedAt: new Date().toISOString(),
      events,
    };
  } catch (err) {
    logger.warn({ err, parcelId }, 'Open-Meteo forecast failed');
    // Graceful empty response — the morning digest skips empty parcels
    return {
      parcelId: parcel._id.toString(),
      parcelName: parcel.name,
      latitude: lat,
      longitude: lon,
      fetchedAt: new Date().toISOString(),
      events: [],
    };
  }
}
