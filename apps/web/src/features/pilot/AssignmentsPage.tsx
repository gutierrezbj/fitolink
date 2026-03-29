import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import OperationKanban from '@/components/OperationKanban.js';
import { toast } from '@/stores/toastStore.js';

export default function AssignmentsPage() {
  const queryClient = useQueryClient();

  const { data: operationsData, isLoading } = useQuery({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations', 'assignments'] });
      toast.success('Asignacion aceptada — operacion en curso');
    },
    onError: () => toast.error('Error al aceptar la asignacion'),
  });

  const rejectMutation = useMutation({
    mutationFn: async (opId: string) => {
      await api.patch(`/operations/${opId}/status`, { status: 'cancelled' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations', 'assignments'] });
      toast.info('Asignacion rechazada');
    },
    onError: () => toast.error('Error al rechazar la asignacion'),
  });

  const operations = operationsData || [];
  const active = operations.filter((op: { status: string }) =>
    op.status === 'assigned' || op.status === 'in_progress'
  );
  const recentCompleted = operations
    .filter((op: { status: string }) => op.status === 'completed')
    .slice(0, 5);
  const visibleOps = [...active, ...recentCompleted];

  const activeCount = active.length;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asignaciones</h1>
          <p className="text-gray-500 text-sm mt-1">
            Operaciones asignadas · actualizado cada 30s
          </p>
        </div>
        {activeCount > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium px-4 py-2 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            {activeCount} activa{activeCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      <OperationKanban
        operations={visibleOps}
        role="pilot"
        onAccept={(id) => acceptMutation.mutate(id)}
        onReject={(id) => rejectMutation.mutate(id)}
        isLoading={acceptMutation.isPending || rejectMutation.isPending}
      />
    </div>
  );
}
