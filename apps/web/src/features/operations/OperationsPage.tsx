import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import { formatDate } from '@/lib/utils.js';

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  assigned: 'Asignada',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const TYPE_LABELS: Record<string, string> = {
  phytosanitary: 'Fitosanitario',
  inspection: 'Inspeccion',
  diagnosis: 'Diagnostico',
};

export default function OperationsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isPilot = user?.role === 'pilot';
  const endpoint = isPilot ? '/operations/assignments' : '/operations/mine';

  const { data: operationsData, isLoading } = useQuery({
    queryKey: ['operations', isPilot ? 'assignments' : 'mine'],
    queryFn: async () => {
      const res = await api.get(endpoint);
      return res.data.data;
    },
  });

  const allOps = operationsData || [];
  const operations = isPilot ? allOps.filter((op: { status: string }) => op.status === 'completed') : allOps;

  if (isLoading) {
    return <div className="text-center py-10 text-gray-500">Cargando operaciones...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isPilot ? 'Historial' : 'Operaciones'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isPilot ? 'Operaciones completadas' : 'Historial de servicios solicitados para tus parcelas'}
        </p>
      </div>

      {operations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-400">No tienes operaciones. Solicita un servicio desde tus alertas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {operations.map((op: {
            _id: string;
            type: string;
            status: string;
            createdAt: string;
            completedAt?: string;
            parcelId?: { name: string; cropType: string; province: string };
            pilotId?: { name: string; rating: number };
            alertId?: { type: string; severity: string; ndviValue: number };
          }) => (
            <div
              key={op._id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => navigate(`/dashboard/operations/${op._id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[op.status] || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_LABELS[op.status] || op.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {TYPE_LABELS[op.type] || op.type}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">
                    {op.parcelId?.name || 'Parcela'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {op.parcelId?.cropType} · {op.parcelId?.province}
                  </p>
                  {op.pilotId && (
                    <p className="text-sm text-brand-600 mt-1">
                      Piloto: {op.pilotId.name}
                    </p>
                  )}
                </div>
                <div className="text-right text-sm">
                  <div className="text-gray-400">{formatDate(op.createdAt)}</div>
                  {op.alertId && (
                    <div className="mt-1 text-red-600 font-medium text-xs">
                      NDVI: {op.alertId.ndviValue?.toFixed(2)}
                    </div>
                  )}
                  {op.completedAt && (
                    <div className="mt-1 text-xs text-green-600">
                      Completada {formatDate(op.completedAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
