import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import { toast } from '@/stores/toastStore.js';

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
};

const SEVERITY_BORDER = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-blue-500',
};

const SEVERITY_LABELS = {
  critical: 'Critica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const STATUS_LABELS = {
  new: 'Nueva',
  notified: 'Notificada',
  acknowledged: 'Revisada',
  resolved: 'Resuelta',
};

type Alert = {
  _id: string;
  type: string;
  severity: keyof typeof SEVERITY_COLORS;
  status: keyof typeof STATUS_LABELS;
  ndviValue: number;
  ndviDelta: number;
  aiConfidence: number;
  detectedAt: string;
  parcelId: { _id: string; name: string; cropType: string; province: string };
};

export default function AlertsPage() {
  const queryClient = useQueryClient();

  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['alerts', 'mine'],
    queryFn: async () => {
      const res = await api.get('/alerts/mine');
      return res.data.data;
    },
  });

  const falsePosiveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.patch(`/alerts/${alertId}`, { status: 'resolved', resolvedBy: 'false_positive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'mine'] });
      toast.info('Alerta marcada como falso positivo');
    },
    onError: () => toast.error('Error al actualizar la alerta'),
  });

  const requestServiceMutation = useMutation({
    mutationFn: async (alert: { _id: string; parcelId: { _id: string } }) => {
      await api.post('/operations', { parcelId: alert.parcelId._id, type: 'phytosanitary', alertId: alert._id });
      await api.patch(`/alerts/${alert._id}`, { status: 'acknowledged' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['operations', 'mine'] });
      toast.success('Servicio solicitado — piloto asignado automaticamente');
    },
    onError: () => toast.error('Error al solicitar el servicio'),
  });

  const alerts: Alert[] = alertsData || [];
  const activeAlerts = alerts.filter((a) => a.status === 'new' || a.status === 'notified');
  const resolvedAlerts = alerts.filter((a) => a.status !== 'new' && a.status !== 'notified');

  if (isLoading) {
    return <div className="text-center py-10 text-gray-500">Cargando alertas...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Anomalias detectadas por satelite en tus parcelas
        </p>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-400">No hay alertas activas. Tus parcelas estan en buen estado.</p>
        </div>
      ) : (
        <>
          {activeAlerts.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Pendientes ({activeAlerts.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert._id}
                    className={`bg-white rounded-xl border border-gray-200 border-l-4 ${SEVERITY_BORDER[alert.severity]} p-4 flex flex-col`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[alert.severity]}`}>
                        {SEVERITY_LABELS[alert.severity]}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(alert.detectedAt)}</span>
                    </div>

                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                      {alert.parcelId?.name || 'Parcela'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {alert.parcelId?.cropType} · {alert.parcelId?.province}
                    </p>

                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-lg font-bold text-red-600">{alert.ndviValue.toFixed(2)}</span>
                      <span className="text-sm text-gray-400">NDVI</span>
                      <span className="text-xs text-red-400 ml-auto">
                        {alert.ndviDelta > 0 ? '+' : ''}{alert.ndviDelta.toFixed(2)}
                      </span>
                    </div>

                    <div className="mt-1 w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${alert.ndviValue < 0.3 ? 'bg-red-500' : alert.ndviValue < 0.5 ? 'bg-orange-400' : 'bg-green-500'}`}
                        style={{ width: `${Math.max(5, alert.ndviValue * 100)}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-gray-400 mt-1">
                      IA: {Math.round(alert.aiConfidence * 100)}% confianza
                    </p>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                      <button
                        onClick={() => requestServiceMutation.mutate(alert)}
                        disabled={requestServiceMutation.isPending}
                        className="flex-1 bg-brand-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
                      >
                        {requestServiceMutation.isPending ? 'Solicitando...' : 'Solicitar servicio'}
                      </button>
                      <button
                        onClick={() => falsePosiveMutation.mutate(alert._id)}
                        disabled={falsePosiveMutation.isPending}
                        className="border border-gray-200 text-gray-500 text-xs px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {falsePosiveMutation.isPending ? '...' : 'Falso positivo'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {resolvedAlerts.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Resueltas ({resolvedAlerts.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {resolvedAlerts.map((alert) => (
                  <div
                    key={alert._id}
                    className="bg-gray-50 rounded-xl border border-gray-200 p-4 opacity-75"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[alert.severity]}`}>
                          {SEVERITY_LABELS[alert.severity]}
                        </span>
                        <span className="text-xs text-gray-400">
                          {STATUS_LABELS[alert.status]}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(alert.detectedAt)}</span>
                    </div>

                    <h3 className="font-medium text-gray-700 text-sm">
                      {alert.parcelId?.name || 'Parcela'}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {alert.parcelId?.cropType} · {alert.parcelId?.province}
                    </p>

                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-gray-500">{alert.ndviValue.toFixed(2)}</span>
                      <span className="text-xs text-gray-400">NDVI ({alert.ndviDelta > 0 ? '+' : ''}{alert.ndviDelta.toFixed(2)})</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
