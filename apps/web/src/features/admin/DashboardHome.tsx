import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import { formatDate } from '@/lib/utils.js';
import PilotDashboardHome from '@/features/pilot/PilotDashboardHome.js';
import InsuranceDashboardHome from '@/features/insurer/InsuranceDashboardHome.js';
import AdminDashboardHome from '@/features/admin/AdminDashboardHome.js';
import ParcelMap from '@/features/parcels/ParcelMap.js';
import HealthScoreGauge from '@/components/HealthScoreGauge.js';

const SEVERITY_COLORS = {
  critical: 'border-l-red-500 bg-red-50',
  high: 'border-l-orange-500 bg-orange-50',
  medium: 'border-l-yellow-500 bg-yellow-50',
  low: 'border-l-blue-500 bg-blue-50',
};

const SEVERITY_LABELS = { critical: 'Critica', high: 'Alta', medium: 'Media', low: 'Baja' };
const SEVERITY_TEXT = {
  critical: 'text-red-700',
  high: 'text-orange-700',
  medium: 'text-yellow-700',
  low: 'text-blue-700',
};

type Severity = keyof typeof SEVERITY_COLORS;
type Alert = {
  _id: string;
  severity: Severity;
  status: string;
  ndviValue: number;
  ndviDelta: number;
  aiConfidence: number;
  detectedAt: string;
  parcelId: { _id: string; name: string; cropType: string; province: string };
};

function AlertCard({ alert, onAck, onService, loading }: {
  alert: Alert;
  onAck: () => void;
  onService: () => void;
  loading: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className={`border-l-4 ${SEVERITY_COLORS[alert.severity]} rounded-r-xl p-3 border border-gray-100`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wide ${SEVERITY_TEXT[alert.severity]}`}>
              {SEVERITY_LABELS[alert.severity]}
            </span>
            <span className="text-[10px] text-gray-400">{formatDate(alert.detectedAt)}</span>
          </div>
          <button
            onClick={() => navigate(`/dashboard/parcels/${alert.parcelId?._id}`)}
            className="text-sm font-semibold text-gray-900 hover:text-brand-700 transition-colors text-left truncate max-w-full block"
          >
            {alert.parcelId?.name || 'Parcela'}
          </button>
          <p className="text-xs text-gray-500">{alert.parcelId?.cropType} · {alert.parcelId?.province}</p>

          <div className="flex items-center gap-2 mt-2">
            <span className={`text-base font-bold ${alert.ndviValue < 0.3 ? 'text-red-600' : 'text-orange-600'}`}>
              {alert.ndviValue.toFixed(3)}
            </span>
            <span className={`text-xs font-medium ${alert.ndviDelta < 0 ? 'text-red-500' : 'text-green-500'}`}>
              {alert.ndviDelta > 0 ? '+' : ''}{alert.ndviDelta.toFixed(3)}
            </span>
          </div>

          {/* Confidence bar */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex-1 bg-white/60 rounded-full h-1">
              <div
                className={`h-1 rounded-full ${alert.aiConfidence > 0.7 ? 'bg-red-500' : 'bg-orange-400'}`}
                style={{ width: `${alert.aiConfidence * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400">{Math.round(alert.aiConfidence * 100)}% IA</span>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 mt-2.5">
        <button
          onClick={onService}
          disabled={loading}
          className="flex-1 bg-brand-600 text-white text-[11px] px-2 py-1.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-semibold"
        >
          Solicitar servicio
        </button>
        <button
          onClick={onAck}
          disabled={loading}
          className="border border-gray-200 bg-white text-gray-500 text-[11px] px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Revisar
        </button>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (user?.role === 'pilot') return <PilotDashboardHome />;
  if (user?.role === 'insurer') return <InsuranceDashboardHome />;
  if (user?.role === 'admin') return <AdminDashboardHome />;

  const isFarmer = user?.role === 'farmer';

  const { data: parcelsData } = useQuery({
    queryKey: ['parcels', 'mine'],
    queryFn: async () => { const res = await api.get('/parcels/mine'); return res.data.data; },
    enabled: isFarmer,
    refetchInterval: 60_000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', 'mine'],
    queryFn: async () => { const res = await api.get('/alerts/mine'); return res.data.data; },
    enabled: isFarmer,
    refetchInterval: 60_000,
  });

  const { data: operationsData } = useQuery({
    queryKey: ['operations', 'mine'],
    queryFn: async () => { const res = await api.get('/operations/mine'); return res.data.data; },
    enabled: isFarmer,
  });

  const requestServiceMutation = useMutation({
    mutationFn: async (alert: Alert) => {
      await api.post('/operations', { parcelId: alert.parcelId._id, type: 'phytosanitary', alertId: alert._id });
      await api.patch(`/alerts/${alert._id}`, { status: 'acknowledged' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['operations', 'mine'] });
    },
  });

  const ackMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.patch(`/alerts/${alertId}`, { status: 'acknowledged' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts', 'mine'] }),
  });

  const parcels = parcelsData || [];
  const alerts: Alert[] = alertsData || [];
  const operations = operationsData || [];

  const activeAlerts = alerts.filter((a) => a.status === 'new' || a.status === 'notified');
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical' || a.severity === 'high');
  const totalHa = parcels.reduce((s: number, p: { areaHa: number }) => s + p.areaHa, 0);
  const thisMonthOps = operations.filter((op: { createdAt: string }) => {
    const d = new Date(op.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // Best and worst parcel by NDVI
  const parcelsWithNdvi = parcels.filter((p: { ndviHistory: { mean: number }[] }) => p.ndviHistory?.length > 0);
  const worstParcel = parcelsWithNdvi.reduce((worst: { ndviHistory: { mean: number }[] } | null, p: { ndviHistory: { mean: number }[] }) => {
    const pNdvi = p.ndviHistory[p.ndviHistory.length - 1].mean;
    if (!worst) return p;
    const wNdvi = worst.ndviHistory[worst.ndviHistory.length - 1].mean;
    return pNdvi < wNdvi ? p : worst;
  }, null) as { _id: string; name: string; ndviHistory: { mean: number }[] } | null;

  const avgNdvi = parcelsWithNdvi.length > 0
    ? parcelsWithNdvi.reduce((s: number, p: { ndviHistory: { mean: number }[] }) => s + p.ndviHistory[p.ndviHistory.length - 1].mean, 0) / parcelsWithNdvi.length
    : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bienvenido, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Panel de control · FitoLink AGDP</p>
        </div>
        {criticalAlerts.length > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-2 rounded-xl animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {criticalAlerts.length} alerta{criticalAlerts.length > 1 ? 's' : ''} critica{criticalAlerts.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Parcelas</p>
          <p className="text-3xl font-bold text-gray-900">{parcels.length}</p>
          <p className="text-xs text-gray-400 mt-1">{totalHa.toFixed(1)} ha monitorizadas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Alertas activas</p>
          <p className={`text-3xl font-bold ${activeAlerts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {activeAlerts.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {activeAlerts.length === 0 ? 'Todo en orden' : `${criticalAlerts.length} criticas`}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">NDVI Promedio</p>
          <p className={`text-3xl font-bold ${avgNdvi === null ? 'text-gray-400' : avgNdvi < 0.3 ? 'text-red-600' : avgNdvi < 0.5 ? 'text-yellow-600' : 'text-green-600'}`}>
            {avgNdvi !== null ? avgNdvi.toFixed(2) : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Sentinel-2 · cada 5 dias</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Operaciones</p>
          <p className="text-3xl font-bold text-gray-900">{thisMonthOps.length}</p>
          <p className="text-xs text-gray-400 mt-1">Este mes</p>
        </div>
      </div>

      {/* Main content: Map + Alert sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Mapa de Parcelas</h2>
            <button
              onClick={() => navigate('/dashboard/parcels')}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              Gestionar →
            </button>
          </div>
          {parcels.length > 0 ? (
            <ParcelMap
              parcels={parcels}
              height="420px"
              showDetailLink
              onParcelClick={(id) => navigate(`/dashboard/parcels/${id}`)}
            />
          ) : (
            <div className="h-[420px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-sm mb-3">Sin parcelas registradas</p>
              <button
                onClick={() => navigate('/dashboard/parcels/new')}
                className="bg-brand-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors font-medium"
              >
                + Registrar primera parcela
              </button>
            </div>
          )}
        </div>

        {/* Alert sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Worst parcel gauge */}
          {worstParcel && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-700">Parcela mas delicada</h2>
                <button
                  onClick={() => navigate(`/dashboard/parcels/${worstParcel._id}`)}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  Ver →
                </button>
              </div>
              <div className="flex items-center gap-4">
                <HealthScoreGauge
                  ndvi={worstParcel.ndviHistory[worstParcel.ndviHistory.length - 1].mean}
                  size={90}
                  showLabel
                />
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{worstParcel.name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Alerts panel */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Alertas pendientes
                {activeAlerts.length > 0 && (
                  <span className="ml-1.5 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {activeAlerts.length}
                  </span>
                )}
              </h2>
              {activeAlerts.length > 0 && (
                <button
                  onClick={() => navigate('/dashboard/alerts')}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  Ver todas →
                </button>
              )}
            </div>

            {activeAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <span className="text-green-600 text-lg">✓</span>
                </div>
                <p className="text-sm text-gray-600 font-medium">Todo en orden</p>
                <p className="text-xs text-gray-400 mt-1">Sin alertas activas</p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-72 pr-0.5">
                {activeAlerts.slice(0, 6).map((alert) => (
                  <AlertCard
                    key={alert._id}
                    alert={alert}
                    loading={requestServiceMutation.isPending || ackMutation.isPending}
                    onService={() => requestServiceMutation.mutate(alert)}
                    onAck={() => ackMutation.mutate(alert._id)}
                  />
                ))}
                {activeAlerts.length > 6 && (
                  <button
                    onClick={() => navigate('/dashboard/alerts')}
                    className="w-full text-xs text-gray-400 hover:text-brand-600 py-2 text-center transition-colors"
                  >
                    +{activeAlerts.length - 6} mas alertas →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
