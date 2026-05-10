import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchForecast,
  weatherLabel,
  windCardinal,
  type DailyForecast,
  type HourlyForecast,
} from './openMeteo.js';
import {
  hourlySuitability,
  aggregateDay,
  workableHoursOfDay,
  SUITABILITY_STYLE,
  type OperationMode,
  type SuitabilityLevel,
} from './suitability.js';

/**
 * Weather forecast widget for a single parcel.
 *
 * Surfaces 7-day daily cards + an hourly table with drone-application
 * suitability badges per hour. Toggle between phytosanitary spraying and
 * multispectral inspection modes — each has its own rule set (see
 * suitability.ts).
 *
 * Open-Meteo is hit directly from the browser (no API key, CORS-open) and
 * cached for 30 min via React Query. One parcel = one fetch.
 */

interface Props {
  lat: number;
  lon: number;
  parcelName?: string;
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function WeatherWidget({ lat, lon, parcelName }: Props) {
  const [mode, setMode] = useState<OperationMode>('phyto');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['weather', lat.toFixed(3), lon.toFixed(3)],
    queryFn: () => fetchForecast(lat, lon),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Per-hour verdicts — cached as a Map keyed by time string
  const hourVerdicts = useMemo(() => {
    if (!data) return new Map<string, ReturnType<typeof hourlySuitability>>();
    const map = new Map<string, ReturnType<typeof hourlySuitability>>();
    data.hourly.forEach((h, i) => {
      // Sum precipitation across the next 4 hours for spray decision
      const nextPrecip = data.hourly
        .slice(i + 1, i + 5)
        .reduce((s, x) => s + (x.precip ?? 0), 0);
      map.set(h.time, hourlySuitability(h, mode, nextPrecip));
    });
    return map;
  }, [data, mode]);

  // Per-day rollup
  const daySummaries = useMemo(() => {
    if (!data) return [];
    return data.daily.map((d) => {
      const hoursOfDay = data.hourly
        .filter((h) => h.time.startsWith(d.date))
        .map((h) => ({ time: h.time, level: (hourVerdicts.get(h.time)?.level ?? 'ok') as SuitabilityLevel }));
      const verdict = aggregateDay(hoursOfDay.map((h) => h.level));
      const workable = workableHoursOfDay(hoursOfDay, d.date);
      return { daily: d, verdict, workable };
    });
  }, [data, hourVerdicts]);

  // Auto-select today (or the first available day)
  const activeDay = selectedDay ?? data?.daily[0]?.date ?? null;
  const hoursForDay = useMemo(() => {
    if (!data || !activeDay) return [];
    return data.hourly.filter((h) => h.time.startsWith(activeDay));
  }, [data, activeDay]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Pronóstico del tiempo</h2>
          <span className="text-xs text-gray-400">cargando…</span>
        </div>
        <div className="h-32 bg-gray-50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Pronóstico del tiempo</h2>
        <p className="text-xs text-gray-500">
          No se pudo cargar el pronóstico. {error instanceof Error ? error.message : ''}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header — branded sky gradient (Open-Meteo / ECMWF) */}
      <div className="bg-gradient-to-r from-sky-700 to-sky-500 px-4 py-3 text-white">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🌤️</span>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Pronóstico 7 días</h2>
              <p className="text-[10px] text-sky-100">
                Open-Meteo · ECMWF · {parcelName ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`}
              </p>
            </div>
          </div>
          {/* Mode toggle */}
          <div className="flex items-center bg-white/15 rounded-full p-0.5 text-[11px]">
            <button
              onClick={() => setMode('phyto')}
              className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                mode === 'phyto' ? 'bg-white text-sky-700' : 'text-white/80 hover:text-white'
              }`}
            >
              Fitosanitario
            </button>
            <button
              onClick={() => setMode('inspection')}
              className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                mode === 'inspection' ? 'bg-white text-sky-700' : 'text-white/80 hover:text-white'
              }`}
            >
              Inspección
            </button>
          </div>
        </div>
      </div>

      {/* 7-day cards */}
      <div className="grid grid-cols-7 gap-1 p-2 border-b border-gray-100">
        {daySummaries.map(({ daily, verdict, workable }) => {
          const isActive = activeDay === daily.date;
          const dayN = new Date(daily.date).getDay();
          const wx = weatherLabel(daily.weatherCode);
          const style = SUITABILITY_STYLE[verdict];
          return (
            <button
              key={daily.date}
              onClick={() => setSelectedDay(daily.date)}
              className={`text-center p-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-sky-50 ring-2 ring-sky-400'
                  : 'hover:bg-gray-50'
              }`}
            >
              <p className="text-[10px] font-bold text-gray-700 truncate">{DAY_NAMES[dayN].slice(0, 3)}</p>
              <p className="text-[9px] text-gray-400">{daily.date.slice(5)}</p>
              <div className="text-xl my-1">{wx.emoji}</div>
              <p className="text-[11px] font-semibold text-gray-800 tabular-nums">
                {Math.round(daily.tempMax)}° <span className="text-gray-400">/ {Math.round(daily.tempMin)}°</span>
              </p>
              <p className="text-[9px] text-gray-500 tabular-nums">
                {daily.precipSum.toFixed(1)} mm
              </p>
              <p className="text-[9px] text-gray-500 tabular-nums">
                💨 {daily.windSpeedMax.toFixed(1)} m/s
              </p>
              <div className={`mt-1 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                <span>{style.emoji}</span>
                <span className="tabular-nums">{workable}h</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Hourly table for selected day */}
      <div className="px-3 pt-2 pb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {activeDay && formatLongDate(activeDay)}
          </p>
          <p className="text-[10px] text-gray-400">
            ventana ideal: {hoursForDay.filter((h) => hourVerdicts.get(h.time)?.level === 'ideal').length} h ·
            aceptable: {hoursForDay.filter((h) => hourVerdicts.get(h.time)?.level === 'ok').length} h
          </p>
        </div>
        <HourlyStrip
          hours={hoursForDay}
          verdicts={hourVerdicts}
        />
      </div>

      {/* Suitability legend */}
      <div className="px-3 pb-3">
        <details className="text-[11px] text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700">¿Cómo se calcula el semáforo?</summary>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] leading-relaxed">
            <div>
              <p className="font-semibold text-gray-700 mb-1">Fitosanitario (drone)</p>
              <ul className="space-y-0.5 text-gray-500">
                <li>· Viento &lt; 3 m/s = ideal · 3–5 = precaución · &gt; 5 = no aplicar</li>
                <li>· Ráfagas &gt; 7 m/s = no aplicar</li>
                <li>· Lluvia o &gt; 60% prob = no aplicar</li>
                <li>· Temp 5–25°C ideal · &gt; 30°C no aplicar</li>
                <li>· Humedad &lt; 30% = precaución (deriva)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Inspección multiespectral</p>
              <ul className="space-y-0.5 text-gray-500">
                <li>· Viento &lt; 7 m/s · ráfagas &lt; 12 m/s</li>
                <li>· Sin lluvia próximas horas</li>
                <li>· Nubosidad &lt; 80% para señal limpia</li>
                <li>· Mejor ventana solar 10–16 h</li>
              </ul>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

// ── Hourly strip ─────────────────────────────────────────────────────────

function HourlyStrip({
  hours,
  verdicts,
}: {
  hours: HourlyForecast[];
  verdicts: Map<string, ReturnType<typeof hourlySuitability>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="text-gray-400 text-[9px] uppercase tracking-wider">
            <th className="text-left font-semibold py-1 pr-2 sticky left-0 bg-white z-10">Hora</th>
            {hours.map((h) => {
              const hourLabel = new Date(h.time).getHours();
              return (
                <th key={h.time} className="font-semibold tabular-nums text-center px-1 min-w-[28px]">
                  {String(hourLabel).padStart(2, '0')}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Suitability row */}
          <tr>
            <td className="text-[9px] text-gray-500 py-0.5 pr-2 sticky left-0 bg-white z-10">Aplicación</td>
            {hours.map((h) => {
              const v = verdicts.get(h.time);
              const style = v ? SUITABILITY_STYLE[v.level] : null;
              const reasons = v?.reasons.join(' · ') || '';
              return (
                <td
                  key={h.time}
                  className={`text-center px-0.5 py-0.5 ${style?.bg ?? ''}`}
                  title={reasons || (v?.level === 'ideal' ? 'condiciones ideales' : '')}
                >
                  <span className="text-[10px]">{style?.emoji}</span>
                </td>
              );
            })}
          </tr>
          <Row label="Temp °C" hours={hours} value={(h) => h.temp.toFixed(0)} highlight={(h) => h.temp > 30 || h.temp < 5} />
          <Row label="Lluvia mm" hours={hours} value={(h) => h.precip.toFixed(1)} highlight={(h) => h.precip > 0.1} />
          <Row label="Prob %" hours={hours} value={(h) => `${h.precipProb}`} highlight={(h) => h.precipProb > 60} />
          <Row label="Viento m/s" hours={hours} value={(h) => h.windSpeed.toFixed(1)} highlight={(h) => h.windSpeed > 5} />
          <Row label="Ráfagas" hours={hours} value={(h) => h.windGusts.toFixed(1)} highlight={(h) => h.windGusts > 7} />
          <Row label="Dirección" hours={hours} value={(h) => windCardinal(h.windDir)} />
          <Row label="Humedad %" hours={hours} value={(h) => `${h.humidity}`} highlight={(h) => h.humidity < 30} />
          <Row label="Nubes %" hours={hours} value={(h) => `${h.cloudCover}`} />
        </tbody>
      </table>
    </div>
  );
}

function Row({
  label,
  hours,
  value,
  highlight,
}: {
  label: string;
  hours: HourlyForecast[];
  value: (h: HourlyForecast) => string;
  highlight?: (h: HourlyForecast) => boolean;
}) {
  return (
    <tr className="border-t border-gray-50">
      <td className="text-[9px] text-gray-500 py-0.5 pr-2 sticky left-0 bg-white z-10">{label}</td>
      {hours.map((h) => {
        const hi = highlight?.(h);
        return (
          <td
            key={h.time}
            className={`text-center text-[10px] tabular-nums px-0.5 py-0.5 ${
              hi ? 'text-red-700 font-semibold' : 'text-gray-700'
            }`}
          >
            {value(h)}
          </td>
        );
      })}
    </tr>
  );
}

function formatLongDate(isoDate: string): string {
  const d = new Date(isoDate);
  const dayN = d.getDay();
  const monthN = d.getMonth();
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${DAY_NAMES[dayN]} ${d.getDate()} ${months[monthN]}`;
}
