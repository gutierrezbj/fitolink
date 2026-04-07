import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
};

const SEVERITY_BORDER_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

const SEVERITY_LABELS = {
  critical: 'Critica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Nueva',
  notified: 'Notificada',
  acknowledged: 'Revisada',
  resolved: 'Resuelta',
};

type Alert = {
  _id: string;
  severity: keyof typeof SEVERITY_COLORS;
  status: string;
  ndviValue: number;
  ndviDelta: number;
  aiConfidence: number;
  detectedAt: string;
  parcelId: { _id: string; name: string; cropType: string; province: string };
};

export default function AlertsPage() {
  const navigate = useNavigate();

  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['alerts', 'mine'],
    queryFn: async () => {
      const res = await api.get('/alerts/mine');
      return res.data.data;
    },
  });

  const alerts: Alert[] = alertsData || [];
  const activeAlerts = alerts.filter((a) => a.status === 'new' || a.status === 'notified');
  const pastAlerts = alerts.filter((a) => a.status !== 'new' && a.status !== 'notified');

  if (isLoading) {
    return <div className="text-center py-10 text-gray-500">Cargando alertas...</div>;
  }

  const AlertCard = ({ alert, dimmed }: { alert: Alert; dimmed?: boolean }) => (
    <button
      onClick={() => navigate(`/dashboard/parcels/${alert.parcelId?._id}`)}
      className={`text-left bg-white rounded-xl border border-gray-200 p-4 flex flex-col hover:border-brand-300 hover:shadow-sm transition-all ${dimmed ? 'opacity-60' : ''}`}
      style={{ borderLeftWidth: 4, borderLeftColor: SEVERITY_BORDER_COLOR[alert.severity] }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${SEVERITY_COLORS[alert.severity]}`}>
            {SEVERITY_LABELS[alert.severity]}
          </span>
          {dimmed && (
            <span className="text-xs text-gray-400">{STATUS_LABELS[alert.status]}</span>
          )}
        </div>
        <span className="text-xs text-gray-400">{formatDate(alert.detectedAt)}</span>
      </div>

      <h3 className="font-semibold text-gray-900 text-sm leading-tight">
        {alert.parcelId?.name || 'Parcela'}
      </h3>
      <p className="text-xs text-gray-500 mt-0.5">
        {alert.parcelId?.cropType} · {alert.parcelId?.province}
      </p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className={`text-lg font-bold ${dimmed ? 'text-gray-500' : 'text-red-600'}`}>
          {alert.ndviValue.toFixed(2)}
        </span>
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

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">IA: {Math.round(alert.aiConfidence * 100)}% confianza</span>
        <span className="text-xs text-brand-600 font-medium">Analizar parcela →</span>
      </div>
    </button>
  );

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-700 transition-colors mb-4"
        >
          ← Volver al inicio
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Anomalias detectadas por satelite · haz click en una alerta para ver el mapa y decidir
        </p>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-green-600 text-xl">✓</span>
          </div>
          <p className="text-gray-600 font-medium">Todo en orden</p>
          <p className="text-gray-400 text-sm mt-1">No hay alertas activas en tus parcelas.</p>
        </div>
      ) : (
        <>
          {activeAlerts.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Pendientes — {activeAlerts.length} alerta{activeAlerts.length > 1 ? 's' : ''} sin revisar
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                {activeAlerts.map((alert) => <AlertCard key={alert._id} alert={alert} />)}
              </div>
            </>
          )}

          {pastAlerts.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Historial ({pastAlerts.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pastAlerts.map((alert) => <AlertCard key={alert._id} alert={alert} dimmed />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
