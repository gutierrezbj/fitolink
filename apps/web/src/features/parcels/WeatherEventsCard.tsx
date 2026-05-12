import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';

/**
 * Ola 1.5 · Pieza 2 — Personalised weather events card.
 *
 * Renders the 7-day list of detected events (cold/warm front, storm,
 * low-pressure rain window, frost, extreme heat, high wind) in the
 * order the operator should react to them. Empty state when the
 * forecast is calm — that is real information too.
 *
 * The morning digest will surface the first 1-2 most urgent events per
 * parcel; this widget shows everything detected in the next 7 days.
 */

type Severity = 'info' | 'warning' | 'alert';
type EventType =
  | 'cold_front'
  | 'warm_front'
  | 'storm'
  | 'low_pressure'
  | 'frost'
  | 'extreme_heat'
  | 'high_wind';

interface WeatherEvent {
  type: EventType;
  severity: Severity;
  date: string;
  dayLabel: string;
  message: string;
  data: Record<string, number | null>;
}

interface WeatherEventsResponse {
  parcelId: string;
  parcelName: string;
  latitude: number;
  longitude: number;
  fetchedAt: string;
  events: WeatherEvent[];
}

interface Props {
  parcelId: string;
}

// ── Display tables ──────────────────────────────────────────────────────

const TYPE_LABEL: Record<EventType, string> = {
  cold_front:    'Frente frío',
  warm_front:    'Frente cálido',
  storm:         'Tormenta',
  low_pressure:  'Borrasca / lluvia sostenida',
  frost:         'Helada',
  extreme_heat:  'Calor extremo',
  high_wind:     'Viento alto',
};

const TYPE_GLYPH: Record<EventType, string> = {
  cold_front:    '↓',  // arrow down — temperature dropping
  warm_front:    '↑',  // arrow up — temperature rising
  storm:         '⚡',  // lightning
  low_pressure:  '☂',  // umbrella
  frost:         '❄',  // snowflake
  extreme_heat:  '☼',  // sun
  high_wind:     '〰',  // wave — wind
};

// Tone classes drive both the side strip and the severity pill.
const TONE: Record<Severity, { strip: string; pill: string; dot: string }> = {
  alert:   { strip: 'bg-agrom-alert',   pill: 'bg-agrom-alert/10 text-agrom-alert',     dot: 'bg-agrom-alert'   },
  warning: { strip: 'bg-agrom-warning', pill: 'bg-agrom-warning/15 text-agrom-warning', dot: 'bg-agrom-warning' },
  info:    { strip: 'bg-agrom-info',    pill: 'bg-agrom-info/15 text-agrom-info',       dot: 'bg-agrom-info'    },
};

const SEV_LABEL: Record<Severity, string> = {
  alert:   'crítica',
  warning: 'aviso',
  info:    'informativa',
};

export default function WeatherEventsCard({ parcelId }: Props) {
  const { data, isLoading } = useQuery<WeatherEventsResponse>({
    queryKey: ['weather-events', parcelId],
    queryFn: async () => {
      const res = await api.get(`/parcels/${parcelId}/insights/weather-events`);
      return res.data.data;
    },
    refetchInterval: 30 * 60 * 1000,
    staleTime: 15 * 60 * 1000,
  });

  return (
    <div className="bg-white rounded-xl border border-agrom-rule/30 overflow-hidden">
      {/* Brand strip header */}
      <div className="bg-agrom-deep px-4 py-2.5 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-agrom-paper/70">
          § METEO 7 DÍAS — EVENTOS A VIGILAR
        </p>
        {data && (
          <p className="font-mono text-[9px] text-agrom-paper/60 tracking-wide">
            {data.events.length} evento{data.events.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {isLoading || !data ? (
        <div className="p-6 text-center text-sm text-agrom-muted">Cargando pronóstico…</div>
      ) : data.events.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="font-display text-lg text-agrom-ink mb-1">Semana tranquila.</p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-agrom-muted">
            Sin eventos climáticos relevantes en los próximos 7 días
          </p>
        </div>
      ) : (
        <ul>
          {data.events.map((event, i) => (
            <li
              key={`${event.type}-${event.date}-${i}`}
              className="flex border-t border-agrom-rule/20 first:border-t-0"
            >
              <span className={`w-1 flex-shrink-0 ${TONE[event.severity].strip}`} />
              <div className="flex-1 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-agrom-deep flex items-center gap-2">
                    <span className="text-base text-agrom-terra leading-none">{TYPE_GLYPH[event.type]}</span>
                    {TYPE_LABEL[event.type]}
                    <span className="text-agrom-muted">·</span>
                    <span className="text-agrom-muted">{event.dayLabel}</span>
                  </p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wider ${TONE[event.severity].pill}`}>
                    <span className={`w-1 h-1 rounded-full ${TONE[event.severity].dot}`} />
                    {SEV_LABEL[event.severity]}
                  </span>
                </div>
                <p className="text-sm text-agrom-ink leading-relaxed">
                  {event.message}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Footer attribution */}
      {data && (
        <div className="px-4 py-2 border-t border-agrom-rule/30 bg-agrom-paper/60">
          <p className="font-mono text-[9px] uppercase tracking-wider text-agrom-muted text-center">
            FUENTE: OPEN-METEO ECMWF · ACTUALIZADO {fmtFetchedAt(data.fetchedAt)}
          </p>
        </div>
      )}
    </div>
  );
}

function fmtFetchedAt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
