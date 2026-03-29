import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-50',
  high: 'border-l-orange-500 bg-orange-50',
  medium: 'border-l-yellow-500 bg-yellow-50',
  low: 'border-l-blue-500 bg-blue-50',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critica', high: 'Alta', medium: 'Media', low: 'Baja',
};

const TYPE_LABELS: Record<string, string> = {
  ndvi_drop: 'Caida NDVI',
  stress_pattern: 'Patron de Estres',
  ndre_anomaly: 'Anomalia NDRE',
};

type Alert = {
  _id: string;
  severity: string;
  type: string;
  status: string;
  ndviValue: number;
  ndviDelta?: number;
  aiConfidence?: number;
  detectedAt: string;
  parcelId?: { _id: string; name?: string; cropType?: string; province?: string; area?: number };
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-orange-400' : 'bg-yellow-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-gray-500 w-7 text-right">{pct}%</span>
    </div>
  );
}

export default function B2BAlertsPage() {
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['b2b', 'alerts'],
    queryFn: async () => { const res = await api.get('/alerts/active'); return res.data.data ?? []; },
    refetchInterval: 30_000,
  });

  const critical = alerts.filter((a: Alert) => a.severity === 'critical');
  const high = alerts.filter((a: Alert) => a.severity === 'high');
  const other = alerts.filter((a: Alert) => a.severity !== 'critical' && a.severity !== 'high');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Alertas en Cartera</h1>
          <p className="text-sm text-gray-500">
            {alerts.length} alerta{alerts.length !== 1 ? 's' : ''} activa{alerts.length !== 1 ? 's' : ''} detectadas por IA
          </p>
        </div>
        {alerts.length > 0 && (
          <div className="flex gap-3 text-xs">
            {critical.length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-semibold">
                {critical.length} Critica{critical.length > 1 ? 's' : ''}
              </span>
            )}
            {high.length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold">
                {high.length} Alta{high.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      )}

      {!isLoading && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-4xl mb-4">✅</p>
          <p className="text-lg font-semibold text-gray-700">Sin alertas activas</p>
          <p className="text-sm text-gray-400 mt-1">Toda la cartera en estado saludable</p>
        </div>
      )}

      {/* Criticas primero */}
      {[...critical, ...high, ...other].map((alert: Alert) => (
        <div
          key={alert._id}
          className={`border-l-4 ${SEVERITY_COLORS[alert.severity] ?? 'border-l-gray-300 bg-gray-50'} rounded-r-xl p-4 border border-gray-100`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Header row */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${SEVERITY_BADGE[alert.severity] ?? ''}`}>
                  {SEVERITY_LABELS[alert.severity] ?? alert.severity}
                </span>
                <span className="text-[11px] text-gray-500 font-medium">
                  {TYPE_LABELS[alert.type] ?? alert.type}
                </span>
                <span className="text-[11px] text-gray-400">·</span>
                <span className="text-[11px] text-gray-400">{formatDate(alert.detectedAt)}</span>
              </div>

              {/* Parcel info */}
              <p className="text-sm font-semibold text-gray-900 truncate">
                {alert.parcelId?.name ?? 'Parcela desconocida'}
              </p>
              <p className="text-xs text-gray-500">
                {alert.parcelId?.cropType} · {alert.parcelId?.province}
                {alert.parcelId?.area ? ` · ${alert.parcelId.area} ha` : ''}
              </p>
            </div>

            {/* NDVI values */}
            <div className="text-right flex-shrink-0">
              <p className="text-xl font-bold text-gray-900">{alert.ndviValue?.toFixed(3)}</p>
              {alert.ndviDelta !== undefined && (
                <p className={`text-xs font-semibold ${alert.ndviDelta < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {alert.ndviDelta > 0 ? '+' : ''}{alert.ndviDelta.toFixed(3)}
                </p>
              )}
              <p className="text-[11px] text-gray-400">NDVI</p>
            </div>
          </div>

          {/* AI confidence */}
          {alert.aiConfidence !== undefined && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500">Confianza IA</span>
              </div>
              <ConfidenceBar value={alert.aiConfidence} />
            </div>
          )}

          {/* Insurer action hint */}
          {(alert.severity === 'critical' || alert.severity === 'high') && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-[11px] text-gray-600 font-medium">
                {alert.severity === 'critical'
                  ? '⚠ Considerar apertura de expediente de siniestro'
                  : '📋 Programar inspeccion de campo'}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
