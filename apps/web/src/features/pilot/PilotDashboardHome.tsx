import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import { formatDate } from '@/lib/utils.js';

const TYPE_LABELS: Record<string, string> = {
  phytosanitary: 'Fitosanitario',
  inspection: 'Inspeccion',
  diagnosis: 'Diagnostico',
};

export default function PilotDashboardHome() {
  const { user } = useAuthStore();

  const { data: operationsData } = useQuery({
    queryKey: ['operations', 'assignments'],
    queryFn: async () => {
      const res = await api.get('/operations/assignments');
      return res.data.data;
    },
  });

  const operations = operationsData || [];
  const pending = operations.filter((op: { status: string }) => op.status === 'assigned');
  const inProgress = operations.filter((op: { status: string }) => op.status === 'in_progress');
  const completedAll = operations.filter((op: { status: string }) => op.status === 'completed');
  const completedThisMonth = completedAll.filter((op: { completedAt?: string }) => {
    if (!op.completedAt) return false;
    const d = new Date(op.completedAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const recentPending = [...pending, ...inProgress].slice(0, 5);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Bienvenido, {user?.name?.split(' ')[0]}
      </h1>
      <p className="text-gray-500 text-sm mb-8">Panel de piloto FitoLink</p>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Asignaciones Pendientes</p>
          <p className={`text-3xl font-bold ${pending.length > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
            {pending.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {pending.length === 0 ? 'Sin pendientes' : 'Requieren aceptacion'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">En Curso</p>
          <p className={`text-3xl font-bold ${inProgress.length > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
            {inProgress.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {inProgress.length === 0 ? 'Ninguna activa' : 'Operaciones activas'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Completadas</p>
          <p className="text-3xl font-bold text-green-600">{completedThisMonth.length}</p>
          <p className="text-xs text-gray-400 mt-1">Este mes ({completedAll.length} total)</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Plataforma</p>
          <p className="text-3xl font-bold text-brand-600">FitoLink</p>
          <p className="text-xs text-gray-400 mt-1">Marketplace de precision</p>
        </div>
      </div>

      {/* Recent assignments */}
      {recentPending.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Asignaciones recientes</h2>
          <div className="space-y-3">
            {recentPending.map((op: {
              _id: string;
              status: string;
              type: string;
              createdAt: string;
              parcelId?: { name: string; cropType: string };
              farmerId?: { name: string };
            }) => (
              <div key={op._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    op.status === 'assigned' ? 'bg-blue-500' : 'bg-purple-500'
                  }`} />
                  <div>
                    <span className="text-sm text-gray-900">{op.parcelId?.name || 'Parcela'}</span>
                    <span className="text-xs text-gray-400 ml-2">{TYPE_LABELS[op.type] || op.type}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400">{formatDate(op.createdAt)}</span>
                  {op.farmerId && (
                    <p className="text-xs text-gray-400">{op.farmerId.name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentPending.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <div className="text-4xl mb-3">🚁</div>
          <p className="text-gray-500 font-medium">Todo al dia</p>
          <p className="text-gray-400 text-sm mt-1">
            No tienes operaciones pendientes. Las nuevas asignaciones apareceran aqui.
          </p>
        </div>
      )}
    </div>
  );
}
