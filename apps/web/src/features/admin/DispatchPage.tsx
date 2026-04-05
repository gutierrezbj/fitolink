import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  assigned: 'Asignada',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  assigned: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const TYPE_LABELS: Record<string, string> = {
  phytosanitary: 'Fitosanitario',
  inspection: 'Inspeccion',
  diagnosis: 'Diagnostico',
};

type Pilot = { _id: string; name: string; email: string; phone?: string; rating?: number };
type Operation = {
  _id: string;
  status: string;
  type: string;
  createdAt: string;
  parcelId: { _id: string; name: string; cropType: string; province: string; areaHa: number; sigpacRef?: string };
  farmerId: { name: string; email: string; phone?: string };
  pilotId?: { name: string; email: string; phone?: string; rating?: number };
  alertId?: { type: string; severity: string; ndviValue: number; ndviDelta: number; aiConfidence: number };
};

function AssignModal({ operation, pilots, onClose, onAssign }: {
  operation: Operation;
  pilots: Pilot[];
  onClose: () => void;
  onAssign: (pilotId: string) => void;
}) {
  const [selected, setSelected] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Asignar operador</h3>
        <p className="text-sm text-gray-500 mb-4">{operation.parcelId?.name} · {TYPE_LABELS[operation.type]}</p>
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
          {pilots.map((p) => (
            <button
              key={p._id}
              onClick={() => setSelected(p._id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                selected === p._id
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-400">{p.email}{p.phone ? ` · ${p.phone}` : ''}{p.rating ? ` · ★ ${p.rating}` : ''}</p>
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => selected && onAssign(selected)}
            disabled={!selected}
            className="flex-1 bg-brand-600 text-white text-sm py-2 rounded-lg hover:bg-brand-700 disabled:opacity-40"
          >
            Asignar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DispatchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [assigningOp, setAssigningOp] = useState<Operation | null>(null);

  const { data: operations = [], isLoading } = useQuery<Operation[]>({
    queryKey: ['admin', 'operations', statusFilter],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/admin/operations${params}`);
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  const { data: pilots = [] } = useQuery<Pilot[]>({
    queryKey: ['admin', 'pilots'],
    queryFn: async () => {
      const res = await api.get('/admin/pilots');
      return res.data.data;
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ opId, pilotId }: { opId: string; pilotId: string }) => {
      await api.patch(`/admin/operations/${opId}/assign`, { pilotId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'operations'] });
      setAssigningOp(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ opId, status }: { opId: string; status: string }) => {
      await api.patch(`/admin/operations/${opId}/status`, { status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'operations'] }),
  });

  const pending = operations.filter((o) => o.status === 'requested').length;
  const inProgress = operations.filter((o) => o.status === 'in_progress').length;
  const assigned = operations.filter((o) => o.status === 'assigned').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Centro de Despacho</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona y coordina todas las operaciones</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
          Actualiza cada 30s
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Pendientes', value: pending, color: 'text-yellow-600', bg: 'bg-yellow-50', status: 'requested' },
          { label: 'Asignadas', value: assigned, color: 'text-blue-600', bg: 'bg-blue-50', status: 'assigned' },
          { label: 'En curso', value: inProgress, color: 'text-purple-600', bg: 'bg-purple-50', status: 'in_progress' },
          { label: 'Total', value: operations.length, color: 'text-gray-900', bg: 'bg-white', status: '' },
        ].map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => setStatusFilter(statusFilter === kpi.status ? '' : kpi.status)}
            className={`${kpi.bg} rounded-xl border p-4 text-left transition-all ${
              statusFilter === kpi.status ? 'border-brand-400 ring-1 ring-brand-300' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </button>
        ))}
      </div>

      {/* Operations table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Solicitudes {statusFilter ? `· ${STATUS_LABELS[statusFilter]}` : '· Todas'}
          </h2>
          {statusFilter && (
            <button onClick={() => setStatusFilter('')} className="text-xs text-brand-600 hover:underline">
              Ver todas
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Cargando...</div>
        ) : operations.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No hay operaciones</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {operations.map((op) => (
              <div key={op._id} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                {/* Alert severity dot */}
                <div className="mt-1 flex-shrink-0">
                  {op.alertId ? (
                    <div className={`w-3 h-3 rounded-full ${SEVERITY_COLORS[op.alertId.severity] || 'bg-gray-300'}`} title={op.alertId.severity} />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-gray-200" />
                  )}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <button
                      onClick={() => navigate(`/dashboard/operations/${op._id}`)}
                      className="text-sm font-semibold text-gray-900 hover:text-brand-600 transition-colors"
                    >
                      {op.parcelId?.name || 'Parcela desconocida'}
                    </button>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[op.status]}`}>
                      {STATUS_LABELS[op.status]}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {TYPE_LABELS[op.type]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {op.parcelId?.cropType} · {op.parcelId?.province} · {op.parcelId?.areaHa} ha
                    {op.parcelId?.sigpacRef && ` · ${op.parcelId.sigpacRef}`}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-xs text-gray-500">
                      👤 <span className="font-medium">{op.farmerId?.name}</span>
                      {op.farmerId?.phone && <span className="text-gray-400"> · {op.farmerId.phone}</span>}
                    </span>
                    {op.pilotId ? (
                      <span className="text-xs text-blue-600">
                        🚁 <span className="font-medium">{op.pilotId.name}</span>
                        {op.pilotId.phone && <span className="text-blue-400"> · {op.pilotId.phone}</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-yellow-600 font-medium">⚠ Sin operador asignado</span>
                    )}
                    {op.alertId && (
                      <span className="text-xs text-gray-400">
                        NDVI {op.alertId.ndviValue?.toFixed(3)} ({op.alertId.ndviDelta > 0 ? '+' : ''}{op.alertId.ndviDelta?.toFixed(3)})
                      </span>
                    )}
                  </div>
                </div>

                {/* Date + actions */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400">{formatDate(op.createdAt)}</span>
                  <div className="flex gap-2">
                    {op.status === 'requested' && (
                      <button
                        onClick={() => setAssigningOp(op)}
                        className="bg-brand-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-brand-700 font-medium whitespace-nowrap"
                      >
                        Asignar operador
                      </button>
                    )}
                    {op.status === 'assigned' && (
                      <button
                        onClick={() => setAssigningOp(op)}
                        className="border border-brand-300 text-brand-600 text-xs px-3 py-1.5 rounded-lg hover:bg-brand-50 font-medium whitespace-nowrap"
                      >
                        Reasignar
                      </button>
                    )}
                    {(op.status === 'requested' || op.status === 'assigned') && (
                      <button
                        onClick={() => statusMutation.mutate({ opId: op._id, status: 'cancelled' })}
                        className="border border-gray-200 text-gray-400 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign modal */}
      {assigningOp && (
        <AssignModal
          operation={assigningOp}
          pilots={pilots}
          onClose={() => setAssigningOp(null)}
          onAssign={(pilotId) => assignMutation.mutate({ opId: assigningOp._id, pilotId })}
        />
      )}
    </div>
  );
}
