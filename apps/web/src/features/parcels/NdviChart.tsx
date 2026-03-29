import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Dot, Legend,
} from 'recharts';
import { formatDate } from '@/lib/utils.js';

interface NdviReading {
  date: string;
  mean: number;
  min: number;
  max: number;
  anomalyDetected: boolean;
  source?: string;
  ndreValue?: number;
}

interface NdviChartProps {
  data: NdviReading[];
  height?: number;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; payload: NdviReading }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">NDVI Medio</span>
          <span className={`font-bold ${d.mean < 0.3 ? 'text-red-600' : d.mean < 0.5 ? 'text-yellow-600' : 'text-green-600'}`}>
            {d.mean.toFixed(3)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Rango</span>
          <span className="text-gray-700">{d.min.toFixed(3)} – {d.max.toFixed(3)}</span>
        </div>
        {d.ndreValue !== undefined && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">NDRE</span>
            <span className="font-medium text-purple-600">{d.ndreValue.toFixed(3)}</span>
          </div>
        )}
        {d.source && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Fuente</span>
            <span className="text-gray-600 uppercase">{d.source}</span>
          </div>
        )}
        {d.anomalyDetected && (
          <div className="mt-1 pt-1 border-t border-red-100">
            <span className="text-red-600 font-semibold">⚠ Anomalia detectada</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NdviChart({ data, height = 320 }: NdviChartProps) {
  const chartData = [...data]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((d) => ({ ...d, dateLabel: formatDate(d.date) }));

  const hasNdre = chartData.some((d) => d.ndreValue !== undefined);

  const anomalyCount = data.filter((d) => d.anomalyDetected).length;

  return (
    <div>
      {anomalyCount > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2.5 bg-red-50 border border-red-100 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          <span className="text-xs text-red-700 font-medium">
            {anomalyCount} anomali{anomalyCount === 1 ? 'a' : 'as'} detectada{anomalyCount > 1 ? 's' : ''} en el historico
          </span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="ndviMeanGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="ndviRangeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#86efac" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#86efac" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="ndreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />

          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(1)}
            width={30}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Critical threshold */}
          <ReferenceLine
            y={0.3}
            stroke="#ef4444"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{ value: 'Critico', position: 'insideTopLeft', fontSize: 10, fill: '#ef4444', dy: -4 }}
          />
          {/* High concern threshold */}
          <ReferenceLine
            y={0.4}
            stroke="#f97316"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{ value: 'Alerta', position: 'insideTopLeft', fontSize: 10, fill: '#f97316', dy: -4 }}
          />

          {/* Range band: max */}
          <Area
            type="monotone"
            dataKey="max"
            stroke="#bbf7d0"
            strokeWidth={1}
            fill="url(#ndviRangeGrad)"
            dot={false}
            activeDot={false}
          />

          {/* Main NDVI mean */}
          <Area
            type="monotone"
            dataKey="mean"
            stroke="#22c55e"
            strokeWidth={2.5}
            fill="url(#ndviMeanGrad)"
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: NdviReading };
              if (payload.anomalyDetected) {
                return (
                  <g key={`dot-${cx}-${cy}`}>
                    <circle cx={cx} cy={cy} r={8} fill="#fef2f2" stroke="#ef4444" strokeWidth={1.5} />
                    <circle cx={cx} cy={cy} r={4} fill="#ef4444" />
                  </g>
                );
              }
              return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="#22c55e" stroke="#fff" strokeWidth={1.5} />;
            }}
            activeDot={{ r: 5, fill: '#16a34a', stroke: '#fff', strokeWidth: 2 }}
          />

          {/* Range band: min */}
          <Area
            type="monotone"
            dataKey="min"
            stroke="#dcfce7"
            strokeWidth={1}
            fill="white"
            dot={false}
            activeDot={false}
          />

          {/* NDRE line — chlorophyll stress index */}
          {hasNdre && (
            <Area
              type="monotone"
              dataKey="ndreValue"
              stroke="#a855f7"
              strokeWidth={2}
              strokeDasharray="5 3"
              fill="url(#ndreGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#9333ea', stroke: '#fff', strokeWidth: 1.5 }}
              connectNulls
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-2 justify-end flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-green-500 inline-block" />
          <span className="text-[11px] text-gray-500">NDVI Medio</span>
        </div>
        {hasNdre && (
          <div className="flex items-center gap-1.5">
            <svg width="14" height="4" className="inline-block">
              <line x1="0" y1="2" x2="14" y2="2" stroke="#a855f7" strokeWidth="2" strokeDasharray="5 3" />
            </svg>
            <span className="text-[11px] text-gray-500">NDRE (clorofila)</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-green-200 inline-block" />
          <span className="text-[11px] text-gray-500">Rango min/max</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span className="text-[11px] text-gray-500">Anomalia</span>
        </div>
      </div>
    </div>
  );
}
