import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import { formatDate } from '@/lib/utils.js';
import PilotDashboardHome from '@/features/pilot/PilotDashboardHome.js';
import InsuranceDashboardHome from '@/features/insurer/InsuranceDashboardHome.js';
import AdminDashboardHome from '@/features/admin/AdminDashboardHome.js';
import CooperativeDashboardHome from '@/features/cooperative/CooperativeDashboardHome.js';
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

function AlertCard({ alert }: { alert: Alert }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/dashboard/parcels/${alert.parcelId?._id}`)}
      className={`border-t-2 ${SEVERITY_COLORS[alert.severity].replace('border-l-', 'border-t-')} bg-white rounded-xl p-2.5 border border-gray-100 flex flex-col gap-1.5 text-left hover:border-brand-200 hover:shadow-sm transition-all w-full`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[9px] font-bold uppercase tracking-wider ${SEVERITY_TEXT[alert.severity]}`}>
          {SEVERITY_LABELS[alert.severity]}
        </span>
        <span className={`text-xs font-bold tabular-nums ${alert.ndviValue < 0.3 ? 'text-red-600' : 'text-orange-500'}`}>
          {alert.ndviValue.toFixed(2)}
        </span>
      </div>
      <p className="text-[11px] font-semibold text-gray-900 leading-tight truncate">
        {alert.parcelId?.name || 'Parcela'}
      </p>
      <p className="text-[10px] text-gray-400 truncate">{alert.parcelId?.province}</p>
      <p className="text-[10px] text-brand-600 font-medium mt-0.5">Ver en mapa →</p>
    </button>
  );
}

/**
 * Empty state para agricultor con 0 parcelas activas (típicamente primer
 * día post-alta). Identidad AgroM editorial. Lleva directo al alta de
 * parcela. Cuando aparezca la primera parcela, este componente desaparece
 * y vuelve el dashboard normal.
 */
function FarmerEmptyState({ userName }: { userName?: string }) {
  const navigate = useNavigate();
  const firstName = userName?.split(' ')[0];
  return (
    <div className="h-full flex items-center justify-center px-6 py-8 overflow-y-auto">
      <div className="max-w-xl w-full text-center">
        {/* Wordmark — coherencia visual con login + emails */}
        <img
          src="/brand/agrom-wordmark.svg"
          alt="AgroM"
          className="h-9 w-auto mx-auto mb-4"
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">
          § FITOLINK · PRIMER PASO
        </p>
        <div className="w-12 h-[2px] bg-terra-500 mx-auto mt-3 mb-6" />

        <h1 className="font-display text-4xl text-brand-600 leading-tight">
          {firstName ? `Bienvenido a AgroM, ${firstName}.` : 'Bienvenido a AgroM.'}
        </h1>
        <p className="text-gray-500 mt-2 text-base">
          Su pistachar, olivar o cereal — empezamos por sus parcelas.
        </p>

        <div className="mt-10 mb-10 text-left bg-white border border-earth-300/40 rounded-xl p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500 mb-4">
            § CÓMO EMPEZAR
          </p>
          <ol className="space-y-4 text-brand-900 text-sm leading-relaxed">
            <li className="flex gap-3">
              <span className="font-mono text-xs text-terra-500 leading-none w-6 pt-1 tracking-wider">01</span>
              <span>
                <b className="text-brand-600 font-semibold">Suba el archivo KMZ</b> de su parcela
                — el que descarga de SIGPAC, Mapping o de su técnico. También se puede dibujar
                el perímetro a mano sobre el mapa.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-terra-500 leading-none w-6 pt-1 tracking-wider">02</span>
              <span>
                <b className="text-brand-600 font-semibold">Elija el cultivo y la provincia.</b>{' '}
                Nuestro sistema consulta el satélite europeo Sentinel-2 sobre sus coordenadas y
                empieza a generar informes.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-terra-500 leading-none w-6 pt-1 tracking-wider">03</span>
              <span>
                <b className="text-brand-600 font-semibold">Su primer informe llega en ~5 días.</b>{' '}
                Cada 5 días el satélite pasa sobre su parcela y los datos se incorporan al
                informe diario que recibe a las 7 de la mañana.
              </span>
            </li>
          </ol>
        </div>

        <button
          onClick={() => navigate('/dashboard/parcels/new')}
          className="inline-block bg-brand-600 text-white font-semibold px-8 py-3.5 rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
        >
          Subir mi primera parcela →
        </button>

        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500 mt-10">
          AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN
        </p>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  if (user?.role === 'pilot') return <PilotDashboardHome />;
  if (user?.role === 'insurer') return <InsuranceDashboardHome />;
  if (user?.role === 'admin') return <AdminDashboardHome />;
  if (user?.role === 'cooperative') return <CooperativeDashboardHome />;

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

  const parcels = parcelsData || [];
  const alerts: Alert[] = alertsData || [];
  const operations = operationsData || [];

  // Empty state — first-time farmer with 0 parcelas. Sustituye el dashboard
  // genérico por un onboarding visual AgroM que lleva directo a /parcels/new.
  if (isFarmer && parcelsData !== undefined && parcels.length === 0) {
    return <FarmerEmptyState userName={user?.name} />;
  }

  const activeAlerts = alerts.filter((a) => a.status === 'new' || a.status === 'notified');
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical' || a.severity === 'high');
  const totalHa = parcels.reduce((s: number, p: { areaHa: number }) => s + p.areaHa, 0);
  const thisMonthOps = operations.filter((op: { createdAt: string }) => {
    const d = new Date(op.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // Best and worst parcel by NDVI
  type ParcelLite = { _id: string; name: string; ndviHistory: { mean: number }[]; establishmentPhase?: boolean };
  const parcelsWithNdvi = parcels.filter((p: ParcelLite) => p.ndviHistory?.length > 0);
  const worstParcel = parcelsWithNdvi.reduce((worst: ParcelLite | null, p: ParcelLite) => {
    const pNdvi = p.ndviHistory[p.ndviHistory.length - 1].mean;
    if (!worst) return p;
    const wNdvi = worst.ndviHistory[worst.ndviHistory.length - 1].mean;
    return pNdvi < wNdvi ? p : worst;
  }, null) as ParcelLite | null;

  const avgNdvi = parcelsWithNdvi.length > 0
    ? parcelsWithNdvi.reduce((s: number, p: { ndviHistory: { mean: number }[] }) => s + p.ndviHistory[p.ndviHistory.length - 1].mean, 0) / parcelsWithNdvi.length
    : null;

  return (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Parcelas</p>
          <p className="text-3xl font-bold text-gray-900">{parcels.length}</p>
          <p className="text-xs text-gray-400 mt-1">{totalHa.toFixed(1)} ha monitorizadas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Alertas activas</p>
          <p className={`text-3xl font-bold ${activeAlerts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {activeAlerts.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {activeAlerts.length === 0 ? 'Todo en orden' : `${criticalAlerts.length} criticas`}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">NDVI Promedio</p>
          <p className={`text-3xl font-bold ${avgNdvi === null ? 'text-gray-400' : avgNdvi < 0.3 ? 'text-red-600' : avgNdvi < 0.5 ? 'text-yellow-600' : 'text-green-600'}`}>
            {avgNdvi !== null ? avgNdvi.toFixed(2) : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Sentinel-2 · cada 5 dias</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Operaciones</p>
          <p className="text-3xl font-bold text-gray-900">{thisMonthOps.length}</p>
          <p className="text-xs text-gray-400 mt-1">Este mes</p>
        </div>
      </div>

      {/* Main content: Map + Alert sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 lg:items-stretch">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">Mapa de Parcelas</h2>
            <button
              onClick={() => navigate('/dashboard/parcels')}
              className="text-xs text-brand-600 hover:text-brand-600 font-medium"
            >
              Gestionar →
            </button>
          </div>
          {parcels.length > 0 ? (
            <div className="flex-1 min-h-[320px] relative">
              <div className="absolute inset-0">
                <ParcelMap
                  parcels={parcels}
                  height="100%"
                  showDetailLink
                  showLegend
                  onParcelClick={(id) => navigate(`/dashboard/parcels/${id}`)}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-[320px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-sm mb-3">Sin parcelas registradas</p>
              <button
                onClick={() => navigate('/dashboard/parcels/new')}
                className="bg-terra-500 text-white text-xs px-4 py-2 rounded-lg hover:bg-terra-600 transition-colors font-medium"
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
                  className="text-xs text-brand-600 hover:text-brand-600 font-medium"
                >
                  Ver →
                </button>
              </div>
              <div className="flex items-center gap-4">
                <HealthScoreGauge
                  ndvi={worstParcel.ndviHistory[worstParcel.ndviHistory.length - 1].mean}
                  size={90}
                  showLabel
                  establishmentPhase={worstParcel.establishmentPhase}
                />
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{worstParcel.name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Alerts panel */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-700">
                Alertas pendientes
                {activeAlerts.length > 0 && (
                  <span className="ml-1.5 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {activeAlerts.length}
                  </span>
                )}
              </h2>
              <button
                onClick={() => navigate('/dashboard/alerts')}
                className="text-xs text-brand-600 hover:text-brand-600 font-medium"
              >
                Ver todas →
              </button>
            </div>

            {activeAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <span className="text-green-600 text-lg">✓</span>
                </div>
                <p className="text-sm text-gray-600 font-medium">Todo en orden</p>
                <p className="text-xs text-gray-400 mt-1">Sin alertas activas</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                <div className="grid grid-cols-2 gap-2">
                {activeAlerts.map((alert) => (
                  <AlertCard
                    key={alert._id}
                    alert={alert}
                  />
                ))}
                </div>
                <button
                  onClick={() => navigate('/dashboard/alerts')}
                  className="w-full text-xs text-brand-600 hover:text-brand-600 border border-brand-200 hover:border-brand-300 bg-brand-50 hover:bg-brand-100 py-2 rounded-lg text-center transition-colors font-medium mt-2"
                >
                  Ver historial completo →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
