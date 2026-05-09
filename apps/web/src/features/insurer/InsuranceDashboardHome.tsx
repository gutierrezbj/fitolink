import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import ParcelMap from '@/features/parcels/ParcelMap.js';

function riskLevel(ndvi: number) {
  if (ndvi < 0.30) return { label: 'Critico', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
  if (ndvi < 0.40) return { label: 'Alto',    color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' };
  if (ndvi < 0.55) return { label: 'Medio',   color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' };
  return                  { label: 'Bajo',    color: 'text-green-600', bg: 'bg-green-50 border-green-200' };
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

  // Drone inspections in the last 30 days — captures the "claim verification"
  // value prop and proves the platform actually moves people on the ground.
  const { data: operations = [] } = useQuery({
    queryKey: ['b2b', 'operations'],
    queryFn: async () => { const res = await api.get('/admin/operations'); return res.data.data ?? []; },
    refetchInterval: 120_000,
  });

  type Parcel = { _id: string; name: string; cropType: string; province: string; areaHa?: number; ndviHistory?: { mean: number }[] };
  type Alert  = { _id: string; severity: string; ndviValue: number; parcelId?: { name: string; province: string } };
  type Operation = { type: string; status: string; createdAt: string };

  const atRisk      = (parcels as Parcel[]).filter(p => (p.ndviHistory?.at(-1)?.mean ?? 1) < 0.40);
  const critical    = (parcels as Parcel[]).filter(p => (p.ndviHistory?.at(-1)?.mean ?? 1) < 0.30);
  const critAlerts  = (alerts  as Alert[]).filter(a => a.severity === 'critical').length;
  const avgNdvi     = parcels.length
    ? (parcels as Parcel[]).reduce((s, p) => s + (p.ndviHistory?.at(-1)?.mean ?? 0), 0) / parcels.length
    : 0;
  const totalHa = (parcels as Parcel[]).reduce((s, p) => s + (p.areaHa ?? 0), 0);

  // Inspections last 30 days (count). The cutoff is rolling so the demo
  // always shows recent activity without re-seeding.
  const cutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const inspections30d = (operations as Operation[]).filter(
    (op) => op.type === 'inspection' && new Date(op.createdAt).getTime() >= cutoff30d,
  ).length;

  const worstParcel = [...(parcels as Parcel[])]
    .filter(p => p.ndviHistory?.length)
    .sort((a, b) => (a.ndviHistory!.at(-1)!.mean) - (b.ndviHistory!.at(-1)!.mean))[0];

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel Aseguradora</h1>
          <p className="text-gray-500 text-sm mt-0.5">{user?.company ?? 'Agromutua'} · Cartera de parcelas aseguradas</p>
        </div>
        <div className="flex items-center gap-3">
          {critAlerts > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-2 rounded-xl animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {critAlerts} siniestro{critAlerts > 1 ? 's' : ''} critico{critAlerts > 1 ? 's' : ''}
            </div>
          )}
          <span className="px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">B2B</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Cartera</p>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">{parcels.length}</p>
          <p className="text-xs text-gray-400 mt-1">parcelas · {totalHa.toFixed(0)} ha</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">NDVI promedio</p>
          <p className={`text-3xl font-bold tabular-nums ${avgNdvi < 0.40 ? 'text-orange-600' : 'text-green-600'}`}>
            {avgNdvi.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Sentinel-2 · cada 5d</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">En riesgo</p>
          <p className={`text-3xl font-bold tabular-nums ${atRisk.length > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {atRisk.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">NDVI &lt; 0.40</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Alertas críticas</p>
          <p className={`text-3xl font-bold tabular-nums ${critAlerts > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {critAlerts}
          </p>
          <p className="text-xs text-gray-400 mt-1">activas ahora</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Inspecciones 30d</p>
          <p className={`text-3xl font-bold tabular-nums ${inspections30d > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
            {inspections30d}
          </p>
          <p className="text-xs text-gray-400 mt-1">vuelos drone realizados</p>
        </div>
      </div>

      {/* Main: map + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 lg:items-stretch">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">Mapa de riesgo — Cartera</h2>
            <button onClick={() => navigate('/dashboard/b2b/parcels')} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              Ver cartera →
            </button>
          </div>
          <div className="flex-1 min-h-[320px] relative">
            <div className="absolute inset-0">
              <ParcelMap
                parcels={parcels}
                height="100%"
                showDetailLink={false}
                onParcelClick={(id) => navigate(`/dashboard/parcels/${id}`)}
              />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Worst parcel */}
          {worstParcel && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Mayor riesgo</h2>
                <button onClick={() => navigate('/dashboard/b2b/parcels')} className="text-xs text-brand-600 font-medium">Ver →</button>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <svg className="w-16 h-16 -rotate-90">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#f3f4f6" strokeWidth="6" />
                    <circle cx="32" cy="32" r="26" fill="none"
                      stroke={worstParcel.ndviHistory!.at(-1)!.mean < 0.30 ? '#ef4444' : worstParcel.ndviHistory!.at(-1)!.mean < 0.45 ? '#f97316' : '#22c55e'}
                      strokeWidth="6"
                      strokeDasharray={`${Math.round(worstParcel.ndviHistory!.at(-1)!.mean * 163)} 163`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-bold text-gray-900">{Math.round(worstParcel.ndviHistory!.at(-1)!.mean * 100)}</span>
                    <span className="text-[9px] text-gray-400">ndvi</span>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{worstParcel.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{worstParcel.cropType} · {worstParcel.province}</p>
                  <p className={`text-xs font-bold mt-1 ${riskLevel(worstParcel.ndviHistory!.at(-1)!.mean).color}`}>
                    {riskLevel(worstParcel.ndviHistory!.at(-1)!.mean).label}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Risk list */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-700">
                Parcelas en riesgo
                {atRisk.length > 0 && (
                  <span className="ml-2 bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{atRisk.length}</span>
                )}
              </h2>
              <button onClick={() => navigate('/dashboard/b2b/alerts')} className="text-xs text-brand-600 font-medium">Alertas →</button>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1">
              {critical.length > 0 && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 mb-2">
                  <p className="text-xs font-semibold text-red-700">⚠ {critical.length} parcela{critical.length > 1 ? 's' : ''} en riesgo crítico</p>
                </div>
              )}
              {[...(parcels as Parcel[])].sort((a, b) => (a.ndviHistory?.at(-1)?.mean ?? 1) - (b.ndviHistory?.at(-1)?.mean ?? 1))
                .slice(0, 6)
                .map(parcel => {
                  const ndvi = parcel.ndviHistory?.at(-1)?.mean;
                  const risk = ndvi !== undefined ? riskLevel(ndvi) : null;
                  return (
                    <button key={parcel._id} onClick={() => navigate('/dashboard/b2b/parcels')}
                      className="w-full text-left p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{parcel.name}</p>
                          <p className="text-[10px] text-gray-400">{parcel.cropType} · {parcel.province}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {ndvi !== undefined && <span className="text-xs font-bold text-gray-700">{ndvi.toFixed(2)}</span>}
                          {risk && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${risk.bg} ${risk.color}`}>{risk.label}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              {parcels.length === 0 && (
                <div className="flex flex-col items-center justify-center h-24 text-center">
                  <p className="text-2xl mb-1">🛡️</p>
                  <p className="text-sm text-gray-400">No hay parcelas aseguradas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
