import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import ParcelMap from '@/features/parcels/ParcelMap.js';

const SEV_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-blue-100 text-blue-700',
};
const SEV_LABEL: Record<string, string> = {
  critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja',
};

export default function AdminDashboardHome() {
  const navigate = useNavigate();

  const { data: parcels = [] } = useQuery({
    queryKey: ['admin', 'parcels'],
    queryFn: async () => { const res = await api.get('/parcels'); return res.data.data ?? []; },
    refetchInterval: 60_000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['admin', 'alerts'],
    queryFn: async () => { const res = await api.get('/alerts/active'); return res.data.data ?? []; },
    refetchInterval: 60_000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => { const res = await api.get('/admin/users'); return res.data.data ?? []; },
    refetchInterval: 120_000,
  });

  const { data: operations = [] } = useQuery({
    queryKey: ['admin', 'operations'],
    queryFn: async () => { const res = await api.get('/admin/operations'); return res.data.data ?? []; },
    refetchInterval: 30_000,
  });

  type Parcel  = { _id: string; name: string; cropType: string; province: string; ndviHistory?: { mean: number }[] };
  type Alert   = { _id: string; severity: string; ndviValue: number; detectedAt: string; parcelId?: { name: string } };
  type User    = { role: string };
  type Op      = { status: string };

  const avgNdvi     = parcels.length
    ? (parcels as Parcel[]).reduce((s, p) => s + (p.ndviHistory?.at(-1)?.mean ?? 0), 0) / parcels.length
    : 0;
  const critCount   = (alerts as Alert[]).filter(a => a.severity === 'critical').length;
  const roleCounts  = (users as User[]).reduce((a, u) => ({ ...a, [u.role]: (a[u.role] ?? 0) + 1 }), {} as Record<string, number>);
  const pending     = (operations as Op[]).filter(o => o.status === 'requested').length;

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel Administrador</h1>
          <p className="text-gray-500 text-sm mt-0.5">Vista global de la plataforma FitoLink</p>
        </div>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <button onClick={() => navigate('/dashboard/admin/dispatch')}
              className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-medium px-4 py-2 rounded-xl hover:bg-yellow-100 transition-colors">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              {pending} operacion{pending > 1 ? 'es' : ''} pendiente{pending > 1 ? 's' : ''}
            </button>
          )}
          <span className="px-3 py-1.5 rounded-full bg-gray-900 text-xs font-semibold text-white">Admin</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button onClick={() => navigate('/dashboard/admin/parcels')}
          className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-500 mb-1">Parcelas totales</p>
          <p className="text-3xl font-bold text-gray-900">{parcels.length}</p>
          <p className="text-xs text-gray-400 mt-1">activas en la plataforma</p>
        </button>
        <button onClick={() => navigate('/dashboard/admin/users')}
          className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-500 mb-1">Usuarios</p>
          <p className="text-3xl font-bold text-gray-900">{users.length}</p>
          <p className="text-xs text-gray-400 mt-1">{roleCounts.farmer ?? 0} agricultores · {roleCounts.pilot ?? 0} pilotos</p>
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">NDVI promedio</p>
          <p className={`text-3xl font-bold ${avgNdvi < 0.40 ? 'text-orange-600' : 'text-green-600'}`}>
            {avgNdvi.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-1">todos los campos</p>
        </div>
        <button onClick={() => navigate('/dashboard/admin/dispatch')}
          className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-500 mb-1">Alertas activas</p>
          <p className={`text-3xl font-bold ${critCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{alerts.length}</p>
          <p className="text-xs text-gray-400 mt-1">{critCount} crítica{critCount !== 1 ? 's' : ''}</p>
        </button>
      </div>

      {/* Main: map + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 lg:items-stretch">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">Mapa global de parcelas</h2>
            <button onClick={() => navigate('/dashboard/admin/parcels')} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              Ver todas →
            </button>
          </div>
          <div className="flex-1 min-h-[320px] relative">
            <div className="absolute inset-0">
              <ParcelMap
                parcels={parcels}
                height="100%"
                showDetailLink
                onParcelClick={(id) => navigate(`/dashboard/parcels/${id}`)}
              />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* User breakdown mini */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Red FitoLink</h2>
              <button onClick={() => navigate('/dashboard/admin/users')} className="text-xs text-brand-600 font-medium">Gestionar →</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([['farmer', 'Agricultores', '/farmer.svg'], ['pilot', 'Pilotos', '/drone-pilot.svg'],
                 ['insurer', 'Aseguradoras', '/insurance2.svg'], ['admin', 'Admin', '/system-administration.svg']] as const)
                .map(([role, label, icon]) => (
                <div key={role} className="bg-gray-50 rounded-lg p-2.5 flex items-center gap-2">
                  <img src={icon} alt={label} className="w-7 h-7" />
                  <div>
                    <p className="text-lg font-bold text-gray-900 leading-none">{roleCounts[role] ?? 0}</p>
                    <p className="text-[10px] text-gray-500">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts list */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-700">
                Alertas recientes
                {critCount > 0 && (
                  <span className="ml-2 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{critCount}</span>
                )}
              </h2>
              <button onClick={() => navigate('/dashboard/admin/alerts')} className="text-xs text-brand-600 font-medium">Ver todas →</button>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1">
              {(alerts as Alert[]).slice(0, 8).map(alert => (
                <div key={alert._id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${SEV_BADGE[alert.severity] ?? ''}`}>
                        {SEV_LABEL[alert.severity] ?? alert.severity}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-800 truncate">{alert.parcelId?.name ?? 'Parcela'}</p>
                    <p className="text-[10px] text-gray-400">{formatDate(alert.detectedAt)}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700 flex-shrink-0 ml-2">{alert.ndviValue?.toFixed(2)}</span>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="flex flex-col items-center justify-center h-24 text-center">
                  <p className="text-2xl mb-1">✅</p>
                  <p className="text-sm text-gray-400">Sin alertas activas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
