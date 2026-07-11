import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import { toast } from '@/stores/toastStore.js';
import OperationKanban from '@/components/OperationKanban.js';

type Op = { _id: string; status: string; parcelId?: { name?: string } };

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
    ? (operationsData || []).filter((op: Op) => op.status === 'completed')
    : operationsData || [];

  // Informe del TRABAJO: agrega varias operaciones completadas en un PDF.
  // Chips seleccionables (por defecto todas); `deselected` guarda las excluidas.
  const completedOps: Op[] = operations.filter((op: Op) => op.status === 'completed');
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [downloadingJob, setDownloadingJob] = useState(false);
  const selectedOps = completedOps.filter((op) => !deselected.has(op._id));

  const toggleOp = (id: string) =>
    setDeselected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function downloadJobReport() {
    if (selectedOps.length === 0) return;
    setDownloadingJob(true);
    try {
      const ids = selectedOps.map((op) => op._id).join(',');
      const res = await api.get('/operations/report/job', { params: { ids }, responseType: 'blob' });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'informe-trabajo.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch {
      toast.error('No se pudo generar el informe del trabajo');
    } finally {
      setDownloadingJob(false);
    }
  }

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

      {completedOps.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Informe del trabajo</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Un solo PDF con los recintos tratados y el total de producto aplicado.
              </p>
            </div>
            <button
              onClick={downloadJobReport}
              disabled={downloadingJob || selectedOps.length === 0}
              className="inline-flex items-center gap-1.5 bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloadingJob ? 'Generando…' : `Descargar informe (${selectedOps.length})`}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {completedOps.map((op) => {
              const on = !deselected.has(op._id);
              return (
                <button
                  key={op._id}
                  type="button"
                  onClick={() => toggleOp(op._id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    on ? 'bg-brand-50 border-brand-300 text-brand-800' : 'bg-white border-gray-200 text-gray-400'
                  }`}
                >
                  {on ? '✓ ' : ''}
                  {op.parcelId?.name || 'Parcela'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <OperationKanban
        operations={operations}
        role={isPilot ? 'pilot' : 'farmer'}
      />
    </div>
  );
}
