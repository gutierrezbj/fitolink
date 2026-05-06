import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
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
  phytosanitary: '/service-phytosanitary.svg',
  inspection: '/service-multispectral.svg',
  diagnosis: '/service-diagnosis.svg',
  herbicide: '/service-herbicide.svg',
  fertilization: '/service-fertilization.svg',
  seeding: '/service-seeding.svg',
};

const FALLBACK_ICON = '/operational-system.svg';

const SEVERITY_RING: Record<string, string> = {
  critical: 'ring-2 ring-red-400',
  high: 'ring-2 ring-orange-400',
  medium: 'ring-1 ring-yellow-300',
  low: 'ring-1 ring-blue-300',
};

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-400',
  low: 'bg-blue-400',
};

type Pilot = { _id: string; name: string; company?: string; phone?: string; rating?: number };
type Operation = {
  _id: string;
  status: string;
  type: string;
  createdAt: string;
  parcelId: { _id: string; name: string; cropType: string; province: string; areaHa: number; sigpacRef?: string };
  farmerId: { name: string; phone?: string };
  pilotId?: { name: string; company?: string; phone?: string; rating?: number };
  alertId?: { severity: string; ndviValue: number; ndviDelta: number };
};

const COLUMNS = [
  { status: 'requested',   label: 'Pendientes',  accent: 'border-t-yellow-400', dot: 'bg-yellow-400', empty: 'Sin solicitudes pendientes' },
  { status: 'assigned',    label: 'Asignadas',   accent: 'border-t-blue-400',   dot: 'bg-blue-400',   empty: 'Ninguna asignada' },
  { status: 'in_progress', label: 'En vuelo',    accent: 'border-t-purple-400', dot: 'bg-purple-500', empty: 'Ninguna en curso' },
  { status: 'completed',   label: 'Completadas', accent: 'border-t-green-400',  dot: 'bg-green-500',  empty: 'Sin completadas hoy' },
];

function AssignModal({ operation, pilots, onClose, onAssign }: {
  operation: Operation;
  pilots: Pilot[];
  onClose: () => void;
  onAssign: (pilotId: string) => void;
}) {
  const [selected, setSelected] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img src={TYPE_ICONS[operation.type] || FALLBACK_ICON} alt="" className="w-10 h-10" />
            <div>
              <h3 className="font-bold text-gray-900">{operation.parcelId?.name}</h3>
              <p className="text-xs text-gray-500">{TYPE_LABELS[operation.type]} · {operation.parcelId?.areaHa} ha</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Seleccionar operador</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {pilots.map(p => (
              <button
                key={p._id}
                onClick={() => setSelected(p._id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selected === p._id ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.company && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{p.company}</span>
                      )}
                      {p.phone && <span className="text-[11px] text-gray-400">{p.phone}</span>}
                    </div>
                  </div>
                  {p.rating && (
                    <span className="text-xs text-yellow-500 font-bold">★ {p.rating.toFixed(1)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => selected && onAssign(selected)}
            disabled={!selected}
            className="flex-1 bg-brand-600 text-white text-sm py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-40 font-semibold"
          >
            Asignar →
          </button>
        </div>
      </div>
    </div>
  );
}

function DispatchCard({ op, onAssign, onCancel, onReassign }: {
  op: Operation;
  onAssign: () => void;
  onCancel: () => void;
  onReassign: () => void;
}) {
  const navigate = useNavigate();
  const sev = op.alertId?.severity;

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group ${sev ? SEVERITY_RING[sev] : ''}`}
      onClick={() => navigate(`/dashboard/operations/${op._id}`)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <img src={TYPE_ICONS[op.type] || FALLBACK_ICON} alt="" className="w-6 h-6" />
          <span className="text-[11px] font-semibold text-gray-500">{TYPE_LABELS[op.type] || op.type}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {sev && <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[sev]}`} title={sev} />}
          <span className="text-[10px] text-gray-400">{formatDate(op.createdAt)}</span>
        </div>
      </div>

      {/* Parcel */}
      <p className="font-bold text-gray-900 text-sm leading-tight group-hover:text-brand-700 transition-colors">
        {op.parcelId?.name}
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5">
        {op.parcelId?.cropType} · {op.parcelId?.province} · {op.parcelId?.areaHa} ha
      </p>

      {/* NDVI pill */}
      {op.alertId?.ndviValue != null && (
        <div className="mt-2 inline-flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1">
          <span className="text-xs font-bold text-red-600">{op.alertId.ndviValue.toFixed(2)}</span>
          <span className="text-[10px] text-red-400">
            {op.alertId.ndviDelta > 0 ? '+' : ''}{op.alertId.ndviDelta?.toFixed(2)} NDVI
          </span>
        </div>
      )}

      {/* People */}
      <div className="mt-2.5 space-y-1">
        <p className="text-[11px] text-gray-500">
          👤 <span className="font-medium text-gray-700">{op.farmerId?.name}</span>
          {op.farmerId?.phone && <span className="text-gray-400"> · {op.farmerId.phone}</span>}
        </p>
        {op.pilotId ? (
          <p className="text-[11px] text-blue-600">
            🚁 <span className="font-medium">{op.pilotId.name}</span>
            {op.pilotId.company && <span className="ml-1 text-[10px] font-bold bg-blue-50 px-1.5 py-0.5 rounded-full">{op.pilotId.company}</span>}
          </p>
        ) : (
          <p className="text-[11px] text-yellow-600 font-semibold">⚠ Sin operador asignado</p>
        )}
      </div>

      {/* Actions */}
      {(op.status === 'requested' || op.status === 'assigned') && (
        <div
          className="mt-3 flex gap-1.5"
          onClick={e => e.stopPropagation()}
        >
          {op.status === 'requested' && (
            <button
              onClick={onAssign}
              className="flex-1 bg-brand-600 text-white text-[11px] py-1.5 rounded-lg hover:bg-brand-700 font-semibold transition-colors"
            >
              Asignar →
            </button>
          )}
          {op.status === 'assigned' && (
            <button
              onClick={onReassign}
              className="flex-1 border border-brand-300 text-brand-600 text-[11px] py-1.5 rounded-lg hover:bg-brand-50 font-semibold transition-colors"
            >
              Reasignar
            </button>
          )}
          <button
            onClick={onCancel}
            className="border border-gray-200 text-gray-400 text-[11px] px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default function DispatchPage() {
  const queryClient = useQueryClient();
  const [assigningOp, setAssigningOp] = useState<Operation | null>(null);

  const { data: operations = [], isLoading } = useQuery<Operation[]>({
    queryKey: ['admin', 'operations'],
    queryFn: async () => {
      const res = await api.get('/admin/operations');
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

  const cancelMutation = useMutation({
    mutationFn: async (opId: string) => {
      await api.patch(`/admin/operations/${opId}/status`, { status: 'cancelled' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'operations'] }),
  });

  const pending  = operations.filter(o => o.status === 'requested').length;
  const assigned = operations.filter(o => o.status === 'assigned').length;
  const flying   = operations.filter(o => o.status === 'in_progress').length;
  const done     = operations.filter(o => o.status === 'completed').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Centro de Despacho</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona y coordina todas las operaciones</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Actualiza cada 30s
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Pendientes',  value: pending,            color: 'text-yellow-600', bg: 'bg-yellow-50',  border: 'border-yellow-200' },
          { label: 'Asignadas',   value: assigned,           color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200' },
          { label: 'En vuelo',    value: flying,             color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-200' },
          { label: 'Completadas', value: done,               color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-200' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-4`}>
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <div key={col.status} className="space-y-3">
              {[...Array(2)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colOps = operations.filter(o => o.status === col.status);
            return (
              <div key={col.status}>
                {/* Column header */}
                <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${col.accent.replace('border-t-', 'border-b-')}`}>
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{col.label}</span>
                  {colOps.length > 0 && (
                    <span className="ml-auto bg-white border border-gray-200 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {colOps.length}
                    </span>
                  )}
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {colOps.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                      <p className="text-xs text-gray-400">{col.empty}</p>
                    </div>
                  ) : (
                    colOps.map(op => (
                      <DispatchCard
                        key={op._id}
                        op={op}
                        onAssign={() => setAssigningOp(op)}
                        onReassign={() => setAssigningOp(op)}
                        onCancel={() => cancelMutation.mutate(op._id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {assigningOp && (
        <AssignModal
          operation={assigningOp}
          pilots={pilots}
          onClose={() => setAssigningOp(null)}
          onAssign={pilotId => assignMutation.mutate({ opId: assigningOp._id, pilotId })}
        />
      )}
    </div>
  );
}
