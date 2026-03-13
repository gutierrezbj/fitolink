import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Dot,
} from 'recharts';
import { formatDate } from '@/lib/utils.js';

interface NdviReading {
  date: string;
  mean: number;
  min: number;
  max: number;
  anomalyDetected: boolean;
}

interface NdviChartProps {
  data: NdviReading[];
  height?: number;
}

export default function NdviChart({ data, height = 300 }: NdviChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    dateLabel: formatDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: number, name: string) => [
            value.toFixed(3),
            name === 'mean' ? 'NDVI Medio' : name === 'min' ? 'NDVI Min' : 'NDVI Max',
          ]}
          labelFormatter={(label: string) => `Fecha: ${label}`}
        />
        <ReferenceLine y={0.4} stroke="#f97316" strokeDasharray="5 5" label="Umbral alerta" />
        <Line
          type="monotone"
          dataKey="max"
          stroke="#bbf7d0"
          strokeWidth={1}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="mean"
          stroke="#22c55e"
          strokeWidth={2}
          dot={(props: Record<string, unknown>) => {
            const { cx, cy, payload } = props as { cx: number; cy: number; payload: NdviReading };
            if (payload.anomalyDetected) {
              return <Dot cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
            }
            return <Dot cx={cx} cy={cy} r={3} fill="#22c55e" />;
          }}
        />
        <Line
          type="monotone"
          dataKey="min"
          stroke="#dcfce7"
          strokeWidth={1}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
