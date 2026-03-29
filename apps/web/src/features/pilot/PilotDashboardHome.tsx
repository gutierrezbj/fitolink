import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import { formatDate } from '@/lib/utils.js';

const TYPE_LABELS: Record<string, string> = {
  phytosanitary: 'Fitosanitario',
  inspection: 'Inspeccion',
  diagnosis: 'Diagnostico',
};

const TYPE_ICONS: Record<string, string> = {
  phytosanitary: '🌿',
  inspection: '🔍',
  diagnosis: '🧬',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

type Operation = {
  _id: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  parcelId?: { name: string; cropType: string; province: string; areaHa?: number };
  farmerId?: { name: string; phone?: string };
  alertId?: { severity: string; ndviValue: number };
  rating?: { farmer?: number };
  flightLog?: { areaHa?: number };
};

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`text-sm ${s <= value ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
      ))}
    </div>
  );
}

function PendingCard({ op, onAccept, onReject, loading }: {
  op: Operation;
  onAccept: () => void;
  onReject: () => void;
  loading: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-blue-400 p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span>{TYPE_ICONS[op.type] || '📋'}</span>
          <span className="text-xs text-gray-500">{TYPE_LABELS[op.type] || op.type}</span>
        </div>
        {op.alertId && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${SEVERITY_COLORS[op.alertId.severity] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {op.alertId.severity}
          </span>
        )}
      </div>

      <button
        onClick={() => navigate(`/dashboard/operations/${op._id}`)}
        className="font-semibold text-gray-900 text-sm hover:text-brand-700 transition-colors text-left block"
      >
        {op.parcelId?.name || 'Parcela'}
      </button>
      <p className="text-xs text-gray-500 mt-0.5">
        {op.parcelId?.cropType}{op.parcelId?.province ? ` · ${op.parcelId.province}` : ''}
        {op.parcelId?.areaHa ? ` · ${op.parcelId.areaHa.toFixed(1)} ha` : ''}
      </p>

      {op.alertId && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span className="text-red-600 font-bold">{op.alertId.ndviValue.toFixed(3)}</span>
          <span className="text-gray-400">NDVI detectado</span>
        </div>
      )}

      {op.farmerId && (
        <p className="text-xs text-gray-400 mt-1">
          Agricultor: <span className="font-medium text-gray-600">{op.farmerId.name}</span>
          {op.farmerId.phone && <span className="ml-1">· {op.farmerId.phone}</span>}
        </p>
      )}

      <p className="text-[11px] text-gray-400 mt-1">{formatDate(op.createdAt)}</p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onAccept}
          disabled={loading}
          className="flex-1 bg-brand-600 text-white text-xs py-2 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-semibold"
        >
          Aceptar
        </button>
        <button
          onClick={onReject}
          disabled={loading}
          className="border border-gray-200 text-gray-500 text-xs px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}

function InProgressCard({ op }: { op: Operation }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-purple-400 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        <span className="text-xs font-semibold text-purple-700">En vuelo</span>
      </div>
      <p className="font-semibold text-gray-900 text-sm">{op.parcelId?.name || 'Parcela'}</p>
      <p className="text-xs text-gray-500 mt-0.5">
        {op.parcelId?.cropType}{op.parcelId?.province ? ` · ${op.parcelId.province}` : ''}
      </p>
      <div className="mt-3">
        <button
          onClick={() => navigate(`/dashboard/operations/${op._id}`)}
          className="w-full bg-purple-600 text-white text-xs py-2 rounded-lg hover:bg-purple-700 transition-colors font-semibold"
        >
          Completar operacion →
        </button>
      </div>
    </div>
  );
}

export default function PilotDashboardHome() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: operationsData } = useQuery({
    queryKey: ['operations', 'assignments'],
    queryFn: async () => {
      const res = await api.get('/operations/assignments');
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  const acceptMutation = useMutation({
    mutationFn: async (opId: string) => {
      await api.patch(`/operations/${opId}/status`, { status: 'in_progress' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operations', 'assignments'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (opId: string) => {
      await api.patch(`/operations/${opId}/status`, { status: 'cancelled' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operations', 'assignments'] }),
  });

  const operations: Operation[] = operationsData || [];
  const pending = operations.filter((op) => op.status === 'assigned');
  const inProgress = operations.filter((op) => op.status === 'in_progress');
  const completedAll = operations.filter((op) => op.status === 'completed');
  const completedThisMonth = completedAll.filter((op) => {
    if (!op.completedAt) return false;
    const d = new Date(op.completedAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalHaFlown = completedAll.reduce((s, op) => s + (op.flightLog?.areaHa || 0), 0);
  const ratingsWithValue = completedAll.filter((op) => op.rating?.farmer !== undefined);
  const avgRating = ratingsWithValue.length > 0
    ? ratingsWithValue.reduce((s, op) => s + (op.rating!.farmer! ), 0) / ratingsWithValue.length
    : null;

  const isLoading = acceptMutation.isPending || rejectMutation.isPending;
  const hasActive = pending.length > 0 || inProgress.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bienvenido, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Panel de piloto · FitoLink</p>
        </div>
        {inProgress.length > 0 && (
          <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium px-4 py-2 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            {inProgress.length} operacion{inProgress.length > 1 ? 'es' : ''} en vuelo
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Pendientes</p>
          <p className={`text-3xl font-bold ${pending.length > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
            {pending.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {pending.length === 0 ? 'Al dia' : 'Esperan tu aceptacion'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Completadas</p>
          <p className="text-3xl font-bold text-green-600">{completedThisMonth.length}</p>
          <p className="text-xs text-gray-400 mt-1">{completedAll.length} totales</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Ha tratadas</p>
          <p className="text-3xl font-bold text-brand-600">
            {totalHaFlown > 0 ? totalHaFlown.toFixed(1) : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">hectareas acumuladas</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-2">Valoracion media</p>
          {avgRating !== null ? (
            <>
              <p className="text-3xl font-bold text-yellow-500">{avgRating.toFixed(1)}</p>
              <StarRating value={Math.round(avgRating)} />
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-400">—</p>
              <p className="text-xs text-gray-400 mt-1">Sin valoraciones aun</p>
            </>
          )}
        </div>
      </div>

      {/* Active operations */}
      {hasActive ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Pending */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Pendientes de aceptar
                {pending.length > 0 && (
                  <span className="ml-1.5 bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {pending.length}
                  </span>
                )}
              </h2>
              {pending.length > 3 && (
                <button
                  onClick={() => navigate('/dashboard/assignments')}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  Ver todas →
                </button>
              )}
            </div>

            {pending.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-400 text-sm">
                Sin pendientes
              </div>
            ) : (
              <div className="space-y-3">
                {pending.slice(0, 3).map((op) => (
                  <PendingCard
                    key={op._id}
                    op={op}
                    loading={isLoading}
                    onAccept={() => acceptMutation.mutate(op._id)}
                    onReject={() => rejectMutation.mutate(op._id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* In progress */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                En curso
                {inProgress.length > 0 && (
                  <span className="ml-1.5 bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {inProgress.length}
                  </span>
                )}
              </h2>
            </div>

            {inProgress.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-400 text-sm">
                Ninguna en vuelo
              </div>
            ) : (
              <div className="space-y-3">
                {inProgress.map((op) => (
                  <InProgressCard key={op._id} op={op} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mb-6">
          <div className="text-5xl mb-4">🚁</div>
          <p className="text-gray-600 font-semibold text-lg">Todo al dia</p>
          <p className="text-gray-400 text-sm mt-2 max-w-xs mx-auto">
            Cuando un agricultor solicite un servicio, aparecera aqui para que lo aceptes.
          </p>
          <button
            onClick={() => navigate('/dashboard/assignments')}
            className="mt-4 text-brand-600 text-sm font-medium hover:text-brand-700 transition-colors"
          >
            Ver historial completo →
          </button>
        </div>
      )}

      {/* Recent completed */}
      {completedAll.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Ultimas completadas</h2>
            <button
              onClick={() => navigate('/dashboard/operations')}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              Ver historial →
            </button>
          </div>
          <div className="space-y-2">
            {completedAll.slice(0, 4).map((op) => (
              <button
                key={op._id}
                onClick={() => navigate(`/dashboard/operations/${op._id}`)}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors text-left border border-transparent hover:border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <span className="text-base">{TYPE_ICONS[op.type] || '📋'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{op.parcelId?.name || 'Parcela'}</p>
                    <p className="text-xs text-gray-400">
                      {op.parcelId?.cropType}{op.parcelId?.province ? ` · ${op.parcelId.province}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {op.rating?.farmer !== undefined && (
                    <div className="flex justify-end mb-0.5">
                      <StarRating value={op.rating.farmer} />
                    </div>
                  )}
                  <p className="text-xs text-gray-400">{op.completedAt ? formatDate(op.completedAt) : ''}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
