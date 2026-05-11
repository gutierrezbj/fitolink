import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '@/lib/api.js';

/**
 * Analytics block for the admin + insurer dashboards.
 *
 * Pattern lifted from OverWatch v2 dashboard analytics (8 KPIs + 4 charts).
 * Here we surface:
 *   1. Stacked weekly bar of alerts by severity (the workhorse trend chart)
 *   2. Donut of severity distribution across the window
 *   3. Top-5 problem parcels horizontal bars
 *
 * Single fetch from /admin/alerts/timeline; cached 60s via React Query.
 * Includes a week-window selector (4 / 8 / 12 / 26) so admins can zoom
 * temporally without leaving the page.
 */

type Bucket = {
  weekStart: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
};

interface TimelineResponse {
  weeks: number;
  buckets: Bucket[];
  bySeverity: { critical: number; high: number; medium: number; low: number };
  byType: Record<string, number>;
  topParcels: Array<{ parcelId: string; parcelName: string; count: number }>;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626', // red-600
  high:     '#ea580c', // orange-600
  medium:   '#ca8a04', // yellow-600
  low:      '#2563eb', // blue-600
};

const WINDOW_OPTIONS = [4, 8, 12, 26] as const;
type WindowWeeks = (typeof WINDOW_OPTIONS)[number];

interface Props {
  initialWeeks?: WindowWeeks;
  /** Optional click handler when user picks a parcel in the top-5 bar. */
  onParcelClick?: (parcelId: string) => void;
  /** Override card title (defaults to "Análisis de alertas"). */
  title?: string;
}

export default function AlertsTimeline({ initialWeeks = 8, onParcelClick, title }: Props) {
  const [weeks, setWeeks] = useWindow(initialWeeks);

  const { data, isLoading } = useQuery<TimelineResponse>({
    queryKey: ['admin', 'alerts', 'timeline', weeks],
    queryFn: async () => {
      const res = await api.get(`/admin/alerts/timeline?weeks=${weeks}`);
      return res.data.data;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const severityData = useMemo(() => {
    if (!data) return [];
    return (Object.entries(data.bySeverity) as Array<[keyof typeof SEVERITY_COLORS, number]>)
      .filter(([, n]) => n > 0)
      .map(([sev, n]) => ({ name: sev, value: n }));
  }, [data]);

  const totalAlerts = data ? data.bySeverity.critical + data.bySeverity.high + data.bySeverity.medium + data.bySeverity.low : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title ?? 'Análisis de alertas'}</h2>
          <p className="text-[11px] text-gray-400">
            {totalAlerts} alertas en últimas {weeks} semanas
          </p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-full p-0.5 text-[11px]">
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                weeks === w ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {w}s
            </button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <div className="p-8 text-center text-sm text-gray-400">Cargando…</div>
      ) : totalAlerts === 0 ? (
        <div className="p-10 text-center">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
            <span className="text-green-600 text-lg">✓</span>
          </div>
          <p className="text-sm text-gray-500">Sin alertas en este período</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
          {/* Weekly stacked bar — spans 2/3 */}
          <div className="lg:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Alertas por semana
            </p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.buckets} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="weekStart"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickFormatter={(v: string) => v.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    labelFormatter={(v: string) => `Semana de ${v}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="critical" stackId="a" fill={SEVERITY_COLORS.critical} name="Crítica" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="high"     stackId="a" fill={SEVERITY_COLORS.high}     name="Alta" />
                  <Bar dataKey="medium"   stackId="a" fill={SEVERITY_COLORS.medium}   name="Media" />
                  <Bar dataKey="low"      stackId="a" fill={SEVERITY_COLORS.low}      name="Baja" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Severity donut — 1/3 */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Distribución severidad
            </p>
            <div className="h-[220px] flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {severityData.map((entry) => (
                      <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name]} stroke="white" strokeWidth={1.5} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(value: number, name: string) => [value, severityLabel(name)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center mt-1">
              {severityData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1 text-[10px] text-gray-600">
                  <span className="w-2 h-2 rounded-full" style={{ background: SEVERITY_COLORS[entry.name] }} />
                  <span className="capitalize">{severityLabel(entry.name)}</span>
                  <span className="font-semibold tabular-nums">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top-5 parcels — full row */}
          {data.topParcels.length > 0 && (
            <div className="lg:col-span-3 mt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Top 5 parcelas con más alertas
              </p>
              <div className="space-y-1.5">
                {data.topParcels.map((p) => {
                  const max = data.topParcels[0].count;
                  const pct = Math.round((p.count / max) * 100);
                  return (
                    <button
                      key={p.parcelId}
                      onClick={() => onParcelClick?.(p.parcelId)}
                      disabled={!onParcelClick}
                      className={`w-full flex items-center gap-3 text-left ${
                        onParcelClick ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
                      } rounded-lg px-2 py-1.5 transition-colors`}
                    >
                      <p className="text-[12px] text-gray-700 font-medium truncate flex-shrink-0" style={{ width: 160 }}>
                        {p.parcelName}
                      </p>
                      <div className="flex-1 bg-gray-100 rounded-full h-3 relative overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[12px] font-bold text-gray-700 tabular-nums" style={{ width: 24 }}>
                        {p.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function severityLabel(s: string): string {
  return s === 'critical' ? 'Crítica' : s === 'high' ? 'Alta' : s === 'medium' ? 'Media' : 'Baja';
}

/** Local state wrapper — keeps the file self-contained without a context. */
import { useState } from 'react';
function useWindow(initial: WindowWeeks): [WindowWeeks, (w: WindowWeeks) => void] {
  const [v, set] = useState<WindowWeeks>(initial);
  return [v, set];
}
