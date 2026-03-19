import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';

const STATUS_COLORS: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Pendiente',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const TYPE_LABELS: Record<string, string> = {
  phytosanitary: 'Fitosanitario',
  inspection: 'Inspeccion',
  diagnosis: 'Diagnostico',
};

type Operation = {
  _id: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  parcelId?: { name: string; cropType: string; province: string; areaHa: number };
  farmerId?: { name: string; email: string; phone?: string };
  alertId?: { type: string; severity: string; ndviValue: number; ndviDelta: number };
};

export default function AssignmentsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: operationsData, isLoading } = useQuery({
    queryKey: ['operations', 'assignments'],
    queryFn: async () => {
      const res = await api.get('/operations/assignments');
      return res.data.data;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (opId: string) => {
      await api.patch(`/operations/${opId}/status`, { status: 'in_progress' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations', 'assignments'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (opId: string) => {
      await api.patch(`/operations/${opId}/status`, { status: 'cancelled' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations', 'assignments'] });
    },
  });

  const operations: Operation[] = operationsData || [];
  const pending = operations.filter((op) => op.status === 'assigned');
  const inProgress = operations.filter((op) => op.status === 'in_progress');
  const completed = operations.filter((op) => op.status === 'completed').slice(0, 5);

  if (isLoading) {
    return <div className="text-center py-10 text-gray-500">Cargando asignaciones...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Asignaciones</h1>
        <p className="text-gray-500 text-sm mt-1">
          Operaciones asignadas a ti por agricultores
        </p>
      </div>

      {operations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <div className="text-4xl mb-3">🚁</div>
          <p className="text-gray-500 font-medium">No tienes asignaciones pendientes</p>
          <p className="text-gray-400 text-sm mt-1">
            Cuando un agricultor solicite un servicio de dron, aparecera aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Pendientes */}
          {pending.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Pendientes ({pending.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                {pending.map((op) => (
                  <div
                    key={op._id}
                    className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-blue-500 p-4 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[op.status]}`}>
                        {STATUS_LABELS[op.status]}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(op.createdAt)}</span>
                    </div>

                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                      {op.parcelId?.name || 'Parcela'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {op.parcelId?.cropType} · {op.parcelId?.province}
                      {op.parcelId?.areaHa ? ` · ${op.parcelId.areaHa.toFixed(1)} ha` : ''}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {TYPE_LABELS[op.type] || op.type}
                      </span>
                      {op.alertId && (
                        <span className="text-xs text-red-600 font-medium">
                          NDVI {op.alertId.ndviValue?.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {op.farmerId && (
                      <p className="text-xs text-gray-400 mt-2">
                        Agricultor: {op.farmerId.name}
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                      <button
                        onClick={() => acceptMutation.mutate(op._id)}
                        disabled={acceptMutation.isPending}
                        className="flex-1 bg-brand-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
                      >
                        {acceptMutation.isPending ? 'Aceptando...' : 'Aceptar'}
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(op._id)}
                        disabled={rejectMutation.isPending}
                        className="border border-gray-200 text-gray-500 text-xs px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* En curso */}
          {inProgress.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                En curso ({inProgress.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                {inProgress.map((op) => (
                  <div
                    key={op._id}
                    className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-purple-500 p-4 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[op.status]}`}>
                        {STATUS_LABELS[op.status]}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(op.createdAt)}</span>
                    </div>

                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                      {op.parcelId?.name || 'Parcela'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {op.parcelId?.cropType} · {op.parcelId?.province}
                      {op.parcelId?.areaHa ? ` · ${op.parcelId.areaHa.toFixed(1)} ha` : ''}
                    </p>

                    <div className="mt-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {TYPE_LABELS[op.type] || op.type}
                      </span>
                    </div>

                    {op.farmerId && (
                      <p className="text-xs text-gray-400 mt-2">
                        Agricultor: {op.farmerId.name}
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => navigate(`/dashboard/operations/${op._id}`)}
                        className="w-full bg-purple-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                      >
                        Completar operacion
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Completadas recientes */}
          {completed.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Completadas recientes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {completed.map((op) => (
                  <div
                    key={op._id}
                    className="bg-gray-50 rounded-xl border border-gray-200 p-4 opacity-75 cursor-pointer hover:opacity-100 transition-opacity"
                    onClick={() => navigate(`/dashboard/operations/${op._id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[op.status]}`}>
                        {STATUS_LABELS[op.status]}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(op.createdAt)}</span>
                    </div>
                    <h3 className="font-medium text-gray-700 text-sm">
                      {op.parcelId?.name || 'Parcela'}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {op.parcelId?.cropType} · {op.parcelId?.province}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
