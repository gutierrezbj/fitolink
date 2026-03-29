import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import OperationKanban from '@/components/OperationKanban.js';

export default function OperationsPage() {
  const { user } = useAuthStore();
  const isPilot = user?.role === 'pilot';

  const { data: operationsData, isLoading } = useQuery({
    queryKey: ['operations', isPilot ? 'assignments' : 'mine'],
    queryFn: async () => {
      const endpoint = isPilot ? '/operations/assignments' : '/operations/mine';
      const res = await api.get(endpoint);
      return res.data.data;
    },
  });

  // Farmers see all their ops in kanban; pilots only see completed here (active ops are in Assignments)
  const operations = isPilot
    ? (operationsData || []).filter((op: { status: string }) => op.status === 'completed')
    : operationsData || [];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-64 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isPilot ? 'Historial de vuelos' : 'Operaciones'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isPilot
            ? 'Operaciones completadas · usa Asignaciones para las activas'
            : 'Seguimiento en tiempo real del estado de tus servicios'}
        </p>
      </div>

      <OperationKanban
        operations={operations}
        role={isPilot ? 'pilot' : 'farmer'}
      />
    </div>
  );
}
