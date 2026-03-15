import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';

export default function DashboardHome() {
  const { user } = useAuthStore();

  const { data: parcelsData } = useQuery({
    queryKey: ['parcels', 'mine'],
    queryFn: async () => {
      const res = await api.get('/parcels/mine');
      return res.data.data;
    },
    enabled: user?.role === 'farmer',
  });

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', 'mine'],
    queryFn: async () => {
      const res = await api.get('/alerts/mine');
      return res.data.data;
    },
    enabled: user?.role === 'farmer',
  });

  const { data: operationsData } = useQuery({
    queryKey: ['operations', 'mine'],
    queryFn: async () => {
      const res = await api.get('/operations/mine');
      return res.data.data;
    },
    enabled: user?.role === 'farmer',
  });

  const parcels = parcelsData || [];
  const alerts = alertsData || [];
  const operations = operationsData || [];
  const thisMonthOps = operations.filter((op: { createdAt: string }) => {
    const d = new Date(op.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const activeAlerts = alerts.filter((a: { status: string }) => a.status === 'new' || a.status === 'notified');
  const totalHa = parcels.reduce((sum: number, p: { areaHa: number }) => sum + p.areaHa, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Bienvenido, {user?.name?.split(' ')[0]}
      </h1>
      <p className="text-gray-500 text-sm mb-8">Panel de control FitoLink</p>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Parcelas</p>
          <p className="text-3xl font-bold text-gray-900">{parcels.length}</p>
          <p className="text-xs text-gray-400 mt-1">{totalHa.toFixed(1)} ha totales</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Alertas Activas</p>
          <p className={`text-3xl font-bold ${activeAlerts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {activeAlerts.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {activeAlerts.length === 0 ? 'Todo en orden' : 'Requieren atencion'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Monitorizacion</p>
          <p className="text-3xl font-bold text-brand-600">Sentinel-2</p>
          <p className="text-xs text-gray-400 mt-1">Cada 5 dias, gratuito</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Operaciones</p>
          <p className="text-3xl font-bold text-gray-900">{thisMonthOps.length}</p>
          <p className="text-xs text-gray-400 mt-1">Este mes</p>
        </div>
      </div>

      {/* Recent alerts */}
      {activeAlerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Alertas recientes</h2>
          <div className="space-y-3">
            {activeAlerts.slice(0, 5).map((alert: {
              _id: string;
              severity: string;
              ndviValue: number;
              parcelId: { name: string };
            }) => (
              <div key={alert._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    alert.severity === 'critical' ? 'bg-red-500' :
                    alert.severity === 'high' ? 'bg-orange-500' :
                    alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <span className="text-sm text-gray-900">{alert.parcelId?.name || 'Parcela'}</span>
                </div>
                <span className="text-sm text-red-600 font-medium">NDVI {alert.ndviValue.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
