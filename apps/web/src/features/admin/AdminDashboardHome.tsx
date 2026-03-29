import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import ParcelMap from '@/features/parcels/ParcelMap.js';

function StatCard({ label, value, sub, accent, onClick }: {
  label: string; value: string | number; sub?: string; accent?: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left w-full ${onClick ? 'hover:shadow-md transition-shadow' : ''}`}
    >
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </button>
  );
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critica', high: 'Alta', medium: 'Media', low: 'Baja',
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

  const avgNdvi = parcels.length
    ? parcels.reduce((s: number, p: { ndviHistory?: { mean: number }[] }) => {
        const last = p.ndviHistory?.at(-1);
        return s + (last?.mean ?? 0);
      }, 0) / parcels.length
    : 0;

  const criticalCount = alerts.filter((a: { severity: string }) => a.severity === 'critical').length;

  const roleCounts = users.reduce((acc: Record<string, number>, u: { role: string }) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel Administrador</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vista global de la plataforma FitoLink</p>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-gray-900 text-xs font-semibold text-white">
          Admin
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Parcelas totales"
          value={parcels.length}
          sub="activas en la plataforma"
          onClick={() => navigate('/dashboard/admin/parcels')}
        />
        <StatCard
          label="Usuarios registrados"
          value={users.length}
          sub={`${roleCounts.farmer ?? 0} agricultores · ${roleCounts.pilot ?? 0} pilotos`}
          onClick={() => navigate('/dashboard/admin/users')}
        />
        <StatCard
          label="NDVI promedio"
          value={avgNdvi.toFixed(3)}
          sub="todos los campos"
          accent={avgNdvi < 0.40 ? 'text-orange-600' : 'text-green-600'}
        />
        <StatCard
          label="Alertas activas"
          value={alerts.length}
          sub={`${criticalCount} critica${criticalCount !== 1 ? 's' : ''}`}
          accent={criticalCount > 0 ? 'text-red-600' : 'text-gray-900'}
          onClick={() => navigate('/dashboard/admin/alerts')}
        />
      </div>

      {/* Map + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Mapa global de parcelas</h2>
          <ParcelMap
            parcels={parcels}
            height="400px"
            showDetailLink
            onParcelClick={(id) => navigate(`/dashboard/parcels/${id}`)}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Alertas recientes</h2>
            <button
              onClick={() => navigate('/dashboard/admin/alerts')}
              className="text-xs text-brand-600 hover:underline"
            >
              Ver todas →
            </button>
          </div>
          <div className="space-y-2 overflow-y-auto flex-1" style={{ maxHeight: 360 }}>
            {alerts.slice(0, 10).map((alert: {
              _id: string; severity: string; ndviValue: number;
              detectedAt: string;
              parcelId?: { name?: string; cropType?: string };
            }) => (
              <div key={alert._id} className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${SEVERITY_BADGE[alert.severity] ?? ''}`}>
                        {SEVERITY_LABELS[alert.severity] ?? alert.severity}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {alert.parcelId?.name ?? 'Parcela desconocida'}
                    </p>
                    <p className="text-[11px] text-gray-400">{formatDate(alert.detectedAt)}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700 flex-shrink-0">
                    {alert.ndviValue?.toFixed(3)}
                  </span>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm text-gray-400">Sin alertas activas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Usuarios por rol</h2>
          <button
            onClick={() => navigate('/dashboard/admin/users')}
            className="text-xs text-brand-600 hover:underline"
          >
            Gestionar →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['farmer', 'pilot', 'insurer', 'admin'] as const).map((role) => {
            const count = roleCounts[role] ?? 0;
            const icons: Record<string, string> = { farmer: '🌾', pilot: '🚁', insurer: '🛡️', admin: '⚙️' };
            const labels: Record<string, string> = { farmer: 'Agricultores', pilot: 'Pilotos', insurer: 'Aseguradoras', admin: 'Admins' };
            return (
              <div key={role} className="p-3 bg-gray-50 rounded-xl text-center">
                <p className="text-2xl mb-1">{icons[role]}</p>
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">{labels[role]}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
