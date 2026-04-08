import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import { formatDate } from '@/lib/utils.js';

const TYPE_LABELS: Record<string, string> = {
  phytosanitary: 'Fitosanitario',
  inspection: 'Inspección',
  diagnosis: 'Diagnóstico',
  herbicide: 'Herbicida',
  fertilization: 'Abonado',
  seeding: 'Siembra',
};
const TYPE_ICONS: Record<string, string> = {
  phytosanitary: '💊', inspection: '📡', diagnosis: '🔬',
  herbicide: '🌿', fertilization: '🌱', seeding: '🌾',
};
const SEV_DOT: Record<string, string> = {
  critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-400', low: 'bg-blue-400',
};

type Operation = {
  _id: string; type: string; status: string; createdAt: string; completedAt?: string;
  parcelId?: { _id?: string; name: string; cropType: string; province: string; areaHa?: number };
  farmerId?: { name: string; phone?: string };
  alertId?: { severity: string; ndviValue?: number };
  rating?: { farmer?: number };
  flightLog?: { areaHa?: number };
};

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <svg key={s} className={`w-3 h-3 ${s <= value ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function PilotDashboardHome() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: operationsData } = useQuery({
    queryKey: ['operations', 'assignments'],
    queryFn: async () => { const res = await api.get('/operations/assignments'); return res.data.data; },
    refetchInterval: 30_000,
  });

  const acceptMutation = useMutation({
    mutationFn: async (opId: string) => { await api.patch(`/operations/${opId}/status`, { status: 'in_progress' }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operations', 'assignments'] }),
  });
  const rejectMutation = useMutation({
    mutationFn: async (opId: string) => { await api.patch(`/operations/${opId}/status`, { status: 'cancelled' }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operations', 'assignments'] }),
  });

  const operations: Operation[] = operationsData || [];
  const pending     = operations.filter(o => o.status === 'assigned');
  const inProgress  = operations.filter(o => o.status === 'in_progress');
  const completedAll = operations.filter(o => o.status === 'completed');
  const completedMonth = completedAll.filter(o => {
    if (!o.completedAt) return false;
    const d = new Date(o.completedAt); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalHa    = completedAll.reduce((s, o) => s + (o.flightLog?.areaHa || 0), 0);
  const ratings    = completedAll.filter(o => o.rating?.farmer !== undefined);
  const avgRating  = ratings.length ? ratings.reduce((s, o) => s + o.rating!.farmer!, 0) / ratings.length : null;
  const isLoading  = acceptMutation.isPending || rejectMutation.isPending;

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bienvenido, {user?.name?.split(' ')[0]}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {(user as { company?: string })?.company
              ? <><span className="font-semibold text-brand-700">{(user as { company?: string }).company}</span> · Panel de piloto</>
              : 'Panel de piloto · FitoLink'
            }
          </p>
        </div>
        {inProgress.length > 0 && (
          <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium px-4 py-2 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            {inProgress.length} operacion{inProgress.length > 1 ? 'es' : ''} en vuelo
          </div>
        )}
        {pending.length > 0 && inProgress.length === 0 && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium px-4 py-2 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            {pending.length} asignacion{pending.length > 1 ? 'es' : ''} nueva{pending.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Pendientes</p>
          <p className={`text-3xl font-bold ${pending.length > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{pending.length}</p>
          <p className="text-xs text-gray-400 mt-1">{pending.length === 0 ? 'Al día' : 'Esperan aceptación'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Completadas</p>
          <p className="text-3xl font-bold text-green-600">{completedMonth.length}</p>
          <p className="text-xs text-gray-400 mt-1">{completedAll.length} totales</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Ha tratadas</p>
          <p className="text-3xl font-bold text-brand-600">{totalHa > 0 ? totalHa.toFixed(1) : '—'}</p>
          <p className="text-xs text-gray-400 mt-1">hectáreas acumuladas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-2">Valoración media</p>
          {avgRating !== null ? (
            <>
              <p className="text-3xl font-bold text-yellow-500">{avgRating.toFixed(1)}</p>
              <StarRating value={Math.round(avgRating)} />
            </>
          ) : (
            <><p className="text-3xl font-bold text-gray-400">—</p><p className="text-xs text-gray-400 mt-1">Sin valoraciones</p></>
          )}
        </div>
      </div>

      {/* Main: operations left + history right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 lg:items-stretch">

        {/* Left — active operations (2/3) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">Operaciones activas</h2>
            <button onClick={() => navigate('/dashboard/assignments')} className="text-xs text-brand-600 font-medium">Ver todas →</button>
          </div>

          {pending.length === 0 && inProgress.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <div className="text-5xl mb-4">🚁</div>
              <p className="text-gray-600 font-semibold">Todo al día</p>
              <p className="text-gray-400 text-sm mt-2 max-w-xs">Cuando un agricultor solicite un servicio aparecerá aquí para que lo aceptes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto flex-1">
              {/* In progress first */}
              {inProgress.map(op => (
                <div key={op._id} className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-xs font-bold text-purple-700">En vuelo</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">{op.parcelId?.name}</p>
                  <p className="text-xs text-gray-500">{op.parcelId?.cropType} · {op.parcelId?.province}</p>
                  <button onClick={() => navigate(`/dashboard/operations/${op._id}`)}
                    className="mt-3 w-full bg-purple-600 text-white text-xs py-2 rounded-lg hover:bg-purple-700 font-semibold transition-colors">
                    Completar vuelo →
                  </button>
                </div>
              ))}
              {/* Pending */}
              {pending.map(op => (
                <div key={op._id} className="bg-white border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{TYPE_ICONS[op.type] || '📋'}</span>
                      <span className="text-xs text-gray-500 font-medium">{TYPE_LABELS[op.type] || op.type}</span>
                    </div>
                    {op.alertId?.severity && (
                      <span className={`w-2 h-2 rounded-full ${SEV_DOT[op.alertId.severity]}`} />
                    )}
                  </div>
                  <button onClick={() => navigate(`/dashboard/operations/${op._id}`)}
                    className="font-semibold text-gray-900 text-sm hover:text-brand-700 transition-colors text-left block">
                    {op.parcelId?.name}
                  </button>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {op.parcelId?.cropType} · {op.parcelId?.province}{op.parcelId?.areaHa ? ` · ${op.parcelId.areaHa.toFixed(1)} ha` : ''}
                  </p>
                  {op.alertId?.ndviValue != null && (
                    <div className="mt-2 inline-flex items-center gap-1 bg-red-50 rounded-lg px-2 py-1">
                      <span className="text-xs font-bold text-red-600">{op.alertId.ndviValue.toFixed(2)}</span>
                      <span className="text-[10px] text-gray-400">NDVI</span>
                    </div>
                  )}
                  {op.farmerId && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      👤 <span className="font-medium text-gray-600">{op.farmerId.name}</span>
                      {op.farmerId.phone && <span className="ml-1">{op.farmerId.phone}</span>}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => acceptMutation.mutate(op._id)} disabled={isLoading}
                      className="flex-1 bg-brand-600 text-white text-xs py-2 rounded-lg hover:bg-brand-700 font-semibold transition-colors disabled:opacity-50">
                      Aceptar
                    </button>
                    <button onClick={() => rejectMutation.mutate(op._id)} disabled={isLoading}
                      className="border border-gray-200 text-gray-500 text-xs px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — recent completed */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">Últimas completadas</h2>
            <button onClick={() => navigate('/dashboard/operations')} className="text-xs text-brand-600 font-medium">Historial →</button>
          </div>

          {completedAll.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm text-gray-400">Sin operaciones completadas aún</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto flex-1">
              {completedAll.slice(0, 8).map(op => (
                <button key={op._id} onClick={() => navigate(`/dashboard/operations/${op._id}`)}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors text-left border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base flex-shrink-0">{TYPE_ICONS[op.type] || '📋'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{op.parcelId?.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {op.parcelId?.cropType}{op.parcelId?.province ? ` · ${op.parcelId.province}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    {op.rating?.farmer !== undefined && (
                      <div className="flex justify-end mb-0.5">
                        <StarRating value={op.rating.farmer} />
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400">{op.completedAt ? formatDate(op.completedAt) : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
