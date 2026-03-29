import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import ParcelMap from '@/features/parcels/ParcelMap.js';

const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const RISK_LABELS: Record<string, string> = {
  critical: 'Riesgo Critico',
  high: 'Riesgo Alto',
  medium: 'Riesgo Medio',
  low: 'Riesgo Bajo',
};

function riskLevel(ndvi: number): string {
  if (ndvi < 0.30) return 'critical';
  if (ndvi < 0.40) return 'high';
  if (ndvi < 0.55) return 'medium';
  return 'low';
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function InsuranceDashboardHome() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: parcels = [] } = useQuery({
    queryKey: ['b2b', 'parcels'],
    queryFn: async () => { const res = await api.get('/parcels'); return res.data.data ?? []; },
    refetchInterval: 60_000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['b2b', 'alerts'],
    queryFn: async () => { const res = await api.get('/alerts/active'); return res.data.data ?? []; },
    refetchInterval: 60_000,
  });

  const criticalParcels = parcels.filter((p: { ndviHistory?: { mean: number }[] }) => {
    const last = p.ndviHistory?.at(-1);
    return last && last.mean < 0.30;
  });

  const atRiskParcels = parcels.filter((p: { ndviHistory?: { mean: number }[] }) => {
    const last = p.ndviHistory?.at(-1);
    return last && last.mean < 0.40;
  });

  const avgNdvi = parcels.length
    ? parcels.reduce((sum: number, p: { ndviHistory?: { mean: number }[] }) => {
        const last = p.ndviHistory?.at(-1);
        return sum + (last?.mean ?? 0);
      }, 0) / parcels.length
    : 0;

  const criticalAlerts = alerts.filter((a: { severity: string }) => a.severity === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Panel Aseguradora
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {user?.company ?? 'Agromutua'} · Cartera de parcelas aseguradas
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
          B2B
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Parcelas aseguradas" value={parcels.length} sub="en cartera activa" />
        <StatCard
          label="NDVI promedio"
          value={avgNdvi.toFixed(3)}
          sub="indice vegetacion medio"
          accent={avgNdvi < 0.40 ? 'text-orange-600' : 'text-green-600'}
        />
        <StatCard
          label="Parcelas en riesgo"
          value={atRiskParcels.length}
          sub="NDVI < 0.40"
          accent={atRiskParcels.length > 0 ? 'text-orange-600' : 'text-gray-900'}
        />
        <StatCard
          label="Alertas criticas"
          value={criticalAlerts}
          sub="activas ahora"
          accent={criticalAlerts > 0 ? 'text-red-600' : 'text-gray-900'}
        />
      </div>

      {/* Map + Risk list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Mapa de riesgo — Cartera</h2>
          <ParcelMap
            parcels={parcels}
            height="380px"
            showDetailLink={false}
          />
        </div>

        {/* Risk list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Parcelas por riesgo</h2>
            <button
              onClick={() => navigate('/dashboard/b2b/parcels')}
              className="text-xs text-brand-600 hover:underline"
            >
              Ver todas →
            </button>
          </div>

          {criticalParcels.length > 0 && (
            <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-100">
              <p className="text-xs font-semibold text-red-700 mb-1">
                ⚠ {criticalParcels.length} parcela{criticalParcels.length > 1 ? 's' : ''} en riesgo critico
              </p>
              <p className="text-[11px] text-red-600">Requieren evaluacion de siniestro inmediata</p>
            </div>
          )}

          <div className="space-y-2 overflow-y-auto flex-1" style={{ maxHeight: 300 }}>
            {[...parcels]
              .sort((a: { ndviHistory?: { mean: number }[] }, b: { ndviHistory?: { mean: number }[] }) => {
                const aN = a.ndviHistory?.at(-1)?.mean ?? 1;
                const bN = b.ndviHistory?.at(-1)?.mean ?? 1;
                return aN - bN;
              })
              .map((parcel: {
                _id: string; name: string; cropType: string; province: string;
                area?: number; ndviHistory?: { mean: number }[];
              }) => {
                const last = parcel.ndviHistory?.at(-1);
                const ndvi = last?.mean;
                const risk = ndvi !== undefined ? riskLevel(ndvi) : 'low';
                return (
                  <button
                    key={parcel._id}
                    onClick={() => navigate('/dashboard/b2b/parcels')}
                    className="w-full text-left p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{parcel.name}</p>
                        <p className="text-[11px] text-gray-400">{parcel.cropType} · {parcel.province}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {ndvi !== undefined && (
                          <span className="text-xs font-bold text-gray-700">{ndvi.toFixed(3)}</span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${RISK_COLORS[risk]}`}>
                          {RISK_LABELS[risk]}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}

            {parcels.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <p className="text-2xl mb-2">🛡️</p>
                <p className="text-sm text-gray-500">No hay parcelas aseguradas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Alertas activas en cartera</h2>
            <button
              onClick={() => navigate('/dashboard/b2b/alerts')}
              className="text-xs text-brand-600 hover:underline"
            >
              Ver todas →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.slice(0, 6).map((alert: {
              _id: string; severity: string; ndviValue: number;
              detectedAt: string;
              parcelId?: { name?: string; cropType?: string; province?: string };
            }) => (
              <div
                key={alert._id}
                className={`p-3 rounded-xl border text-sm ${RISK_COLORS[alert.severity] ?? RISK_COLORS.low}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[11px] uppercase tracking-wide">
                    {RISK_LABELS[alert.severity] ?? alert.severity}
                  </span>
                  <span className="font-bold">NDVI {alert.ndviValue?.toFixed(3)}</span>
                </div>
                <p className="text-[11px] opacity-80 truncate">
                  {alert.parcelId?.name ?? 'Parcela desconocida'} · {alert.parcelId?.province}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
