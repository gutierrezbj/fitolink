/**
 * Open-Meteo Forecast API client.
 *
 * Free, no API key, no practical rate limit. Sin `models=`, Open-Meteo usa
 * `best_match`: elige el mejor modelo disponible por ubicación (ECMWF/IFS,
 * GFS, ICON…), lo correcto para un producto global (España → RD). Por eso el
 * eyebrow cita "Open-Meteo" a secas, no un modelo concreto que no pedimos.
 * Ya usamos Open-Meteo para las bases climáticas históricas (climate_context.py).
 *
 * The client hits the public endpoint directly from the browser — no
 * backend round-trip needed. Open-Meteo allows CORS for any origin.
 */

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

/** Hourly variables we ask for. Order matches what the UI renders. */
const HOURLY_VARS = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'precipitation_probability',
  'cloudcover',
  'windspeed_10m',          // m/s by default in Open-Meteo
  'winddirection_10m',
  'windgusts_10m',
  'et0_fao_evapotranspiration',
];

const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'windspeed_10m_max',
  'winddirection_10m_dominant',
  'weathercode',
];

export interface DailyForecast {
  date: string;             // ISO yyyy-mm-dd
  tempMax: number;          // °C
  tempMin: number;          // °C
  precipSum: number;        // mm
  precipProbMax: number;    // 0-100
  windSpeedMax: number;     // m/s
  windDir: number;          // 0-360
  weatherCode: number;      // WMO code
}

export interface HourlyForecast {
  time: string;             // ISO datetime
  temp: number;             // °C
  humidity: number;         // 0-100
  precip: number;           // mm
  precipProb: number;       // 0-100
  cloudCover: number;       // 0-100
  windSpeed: number;        // m/s
  windDir: number;          // 0-360
  windGusts: number;        // m/s
  et0: number;              // mm
}

export interface ForecastResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  daily: DailyForecast[];
  hourly: HourlyForecast[];
}

interface RawResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    windspeed_10m_max: number[];
    winddirection_10m_dominant: number[];
    weathercode: number[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation: number[];
    precipitation_probability: number[];
    cloudcover: number[];
    windspeed_10m: number[];
    winddirection_10m: number[];
    windgusts_10m: number[];
    et0_fao_evapotranspiration: number[];
  };
}

/**
 * Fetch a 7-day forecast for the given lat/lon. Open-Meteo returns wind
 * speed in km/h by default — we ask for m/s explicitly (`windspeed_unit`)
 * because every agronomic threshold (drift, drone op) is expressed in m/s.
 */
export async function fetchForecast(lat: number, lon: number): Promise<ForecastResponse> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: HOURLY_VARS.join(','),
    daily: DAILY_VARS.join(','),
    timezone: 'auto',
    forecast_days: '7',
    windspeed_unit: 'ms',
  });

  const res = await fetch(`${OPEN_METEO_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Open-Meteo error ${res.status}`);
  }
  const raw = (await res.json()) as RawResponse;

  const daily: DailyForecast[] = raw.daily.time.map((d, i) => ({
    date: d,
    tempMax: raw.daily.temperature_2m_max[i],
    tempMin: raw.daily.temperature_2m_min[i],
    precipSum: raw.daily.precipitation_sum[i],
    precipProbMax: raw.daily.precipitation_probability_max[i] ?? 0,
    windSpeedMax: raw.daily.windspeed_10m_max[i],
    windDir: raw.daily.winddirection_10m_dominant[i],
    weatherCode: raw.daily.weathercode[i],
  }));

  const hourly: HourlyForecast[] = raw.hourly.time.map((t, i) => ({
    time: t,
    temp: raw.hourly.temperature_2m[i],
    humidity: raw.hourly.relative_humidity_2m[i],
    precip: raw.hourly.precipitation[i],
    precipProb: raw.hourly.precipitation_probability[i] ?? 0,
    cloudCover: raw.hourly.cloudcover[i],
    windSpeed: raw.hourly.windspeed_10m[i],
    windDir: raw.hourly.winddirection_10m[i],
    windGusts: raw.hourly.windgusts_10m[i],
    et0: raw.hourly.et0_fao_evapotranspiration[i] ?? 0,
  }));

  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    timezone: raw.timezone,
    daily,
    hourly,
  };
}

/** Compass cardinal from degrees — 16-point rose. */
export function windCardinal(degrees: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round(((degrees % 360) / 22.5)) % 16;
  return dirs[idx];
}

/**
 * WMO weather code → human label + emoji (we keep emojis here because the
 * weather *icons* are a universally accepted convention, unlike sidebar
 * nav). The full code list is at https://open-meteo.com/en/docs.
 */
export function weatherLabel(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: 'Despejado', emoji: '☀️' };
  if (code === 1 || code === 2) return { label: 'Mayormente soleado', emoji: '🌤️' };
  if (code === 3) return { label: 'Nublado', emoji: '☁️' };
  if (code >= 45 && code <= 48) return { label: 'Niebla', emoji: '🌫️' };
  if (code >= 51 && code <= 57) return { label: 'Llovizna', emoji: '🌦️' };
  if (code >= 61 && code <= 67) return { label: 'Lluvia', emoji: '🌧️' };
  if (code >= 71 && code <= 77) return { label: 'Nieve', emoji: '🌨️' };
  if (code >= 80 && code <= 82) return { label: 'Chubascos', emoji: '🌧️' };
  if (code >= 95) return { label: 'Tormenta', emoji: '⛈️' };
  return { label: '—', emoji: '·' };
}
