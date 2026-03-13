import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
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

export default function AlertsPage() {
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['alerts', 'mine'],
    queryFn: async () => {
      const res = await api.get('/alerts/mine');
      return res.data.data;
    },
  });

  const alerts = alertsData || [];

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
        <div className="space-y-4">
          {alerts.map((alert: {
            _id: string;
            type: string;
            severity: keyof typeof SEVERITY_COLORS;
            status: keyof typeof STATUS_LABELS;
            ndviValue: number;
            ndviDelta: number;
            aiConfidence: number;
            detectedAt: string;
            parcelId: { name: string; cropType: string; province: string };
          }) => (
            <div
              key={alert._id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[alert.severity]}`}>
                      {SEVERITY_LABELS[alert.severity]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {STATUS_LABELS[alert.status]}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">
                    {alert.parcelId?.name || 'Parcela'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {alert.parcelId?.cropType} · {alert.parcelId?.province}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <div className="text-gray-400">{formatDate(alert.detectedAt)}</div>
                  <div className="mt-1">
                    <span className="text-red-600 font-medium">NDVI: {alert.ndviValue.toFixed(2)}</span>
                    <span className="text-gray-400 ml-1">({alert.ndviDelta > 0 ? '+' : ''}{alert.ndviDelta.toFixed(2)})</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Confianza IA: {Math.round(alert.aiConfidence * 100)}%
                  </div>
                </div>
              </div>

              {alert.status === 'new' || alert.status === 'notified' ? (
                <div className="mt-4 flex gap-2">
                  <button className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
                    Solicitar servicio
                  </button>
                  <button className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                    Falso positivo
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
