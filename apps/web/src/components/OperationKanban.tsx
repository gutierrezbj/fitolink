import { useNavigate } from 'react-router-dom';
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

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

export type Operation = {
  _id: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  parcelId?: { _id?: string; name: string; cropType: string; province: string; areaHa?: number };
  pilotId?: { name: string; rating?: number };
  farmerId?: { name: string; phone?: string };
  alertId?: { severity: string; ndviValue: number; ndviDelta?: number };
  rating?: { farmer?: number; pilot?: number };
};

interface KanbanColumn {
  key: string;
  label: string;
  accent: string;
  headerBg: string;
  emptyText: string;
}

interface OperationKanbanProps {
  operations: Operation[];
  role: 'farmer' | 'pilot';
  onAccept?: (opId: string) => void;
  onReject?: (opId: string) => void;
  isLoading?: boolean;
}

const FARMER_COLUMNS: KanbanColumn[] = [
  { key: 'requested', label: 'Solicitada', accent: 'border-t-yellow-400', headerBg: 'bg-yellow-50', emptyText: 'Sin solicitudes pendientes' },
  { key: 'assigned', label: 'Asignada', accent: 'border-t-blue-400', headerBg: 'bg-blue-50', emptyText: 'Ninguna asignada aun' },
  { key: 'in_progress', label: 'En curso', accent: 'border-t-purple-400', headerBg: 'bg-purple-50', emptyText: 'Ninguna en vuelo' },
  { key: 'completed', label: 'Completada', accent: 'border-t-green-400', headerBg: 'bg-green-50', emptyText: 'Sin completadas' },
];

const PILOT_COLUMNS: KanbanColumn[] = [
  { key: 'assigned', label: 'Pendiente', accent: 'border-t-blue-400', headerBg: 'bg-blue-50', emptyText: 'Sin asignaciones nuevas' },
  { key: 'in_progress', label: 'En curso', accent: 'border-t-purple-400', headerBg: 'bg-purple-50', emptyText: 'Ninguna en vuelo' },
  { key: 'completed', label: 'Completada', accent: 'border-t-green-400', headerBg: 'bg-green-50', emptyText: 'Sin operaciones completadas' },
];

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`text-[10px] ${s <= value ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
      ))}
    </div>
  );
}

function OperationCard({ op, role, onAccept, onReject, isLoading }: {
  op: Operation;
  role: 'farmer' | 'pilot';
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  isLoading?: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => navigate(`/dashboard/operations/${op._id}`)}
    >
      {/* Top row: type icon + alert severity */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{TYPE_ICONS[op.type] || '📋'}</span>
          <span className="text-[11px] text-gray-500 font-medium">{TYPE_LABELS[op.type] || op.type}</span>
        </div>
        {op.alertId && (
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[op.alertId.severity] || 'bg-gray-400'}`} />
            <span className="text-[10px] text-gray-400 font-medium uppercase">{op.alertId.severity}</span>
          </div>
        )}
      </div>

      {/* Parcel name */}
      <h4 className="font-semibold text-gray-900 text-sm leading-tight mb-0.5 group-hover:text-brand-700 transition-colors">
        {op.parcelId?.name || 'Parcela'}
      </h4>
      <p className="text-[11px] text-gray-500">
        {op.parcelId?.cropType}{op.parcelId?.province ? ` · ${op.parcelId.province}` : ''}
        {op.parcelId?.areaHa ? ` · ${op.parcelId.areaHa.toFixed(1)} ha` : ''}
      </p>

      {/* NDVI alert value */}
      {op.alertId && (
        <div className="mt-2 flex items-baseline gap-1.5 bg-red-50 rounded-lg px-2 py-1.5">
          <span className="text-sm font-bold text-red-600">{op.alertId.ndviValue.toFixed(3)}</span>
          {op.alertId.ndviDelta !== undefined && (
            <span className="text-[11px] text-red-400">
              {op.alertId.ndviDelta > 0 ? '+' : ''}{op.alertId.ndviDelta.toFixed(3)}
            </span>
          )}
          <span className="text-[10px] text-gray-400 ml-auto">NDVI</span>
        </div>
      )}

      {/* Pilot / farmer info */}
      {role === 'farmer' && op.pilotId && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">Piloto: <span className="text-gray-700 font-medium">{op.pilotId.name}</span></span>
          {op.pilotId.rating !== undefined && op.pilotId.rating > 0 && (
            <StarRating value={Math.round(op.pilotId.rating)} />
          )}
        </div>
      )}
      {role === 'pilot' && op.farmerId && (
        <p className="mt-2 text-[11px] text-gray-400">
          Agricultor: <span className="text-gray-700 font-medium">{op.farmerId.name}</span>
        </p>
      )}

      {/* Completed rating */}
      {op.status === 'completed' && op.rating?.farmer !== undefined && role === 'farmer' && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[11px] text-gray-400">Tu valoracion:</span>
          <StarRating value={op.rating.farmer} />
        </div>
      )}
      {op.status === 'completed' && op.rating?.pilot !== undefined && role === 'pilot' && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[11px] text-gray-400">Valoracion:</span>
          <StarRating value={op.rating.pilot} />
        </div>
      )}

      {/* Date */}
      <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between text-[10px] text-gray-400">
        <span>Solicitada {formatDate(op.createdAt)}</span>
        {op.completedAt && <span className="text-green-600">✓ {formatDate(op.completedAt)}</span>}
      </div>

      {/* Pilot action buttons — inline in card, stop propagation */}
      {role === 'pilot' && op.status === 'assigned' && (onAccept || onReject) && (
        <div
          className="mt-2.5 flex gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onAccept?.(op._id)}
            disabled={isLoading}
            className="flex-1 bg-brand-600 text-white text-[11px] py-1.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-semibold"
          >
            Aceptar
          </button>
          <button
            onClick={() => onReject?.(op._id)}
            disabled={isLoading}
            className="border border-gray-200 text-gray-500 text-[11px] px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      )}

      {role === 'pilot' && op.status === 'in_progress' && (
        <div
          className="mt-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => navigate(`/dashboard/operations/${op._id}`)}
            className="w-full bg-purple-600 text-white text-[11px] py-1.5 rounded-lg hover:bg-purple-700 transition-colors font-semibold"
          >
            Completar vuelo →
          </button>
        </div>
      )}
    </div>
  );
}

export default function OperationKanban({ operations, role, onAccept, onReject, isLoading }: OperationKanbanProps) {
  const columns = role === 'farmer' ? FARMER_COLUMNS : PILOT_COLUMNS;

  const getColumnOps = (status: string) =>
    operations.filter((op) => op.status === status);

  if (operations.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-4xl mb-3">{role === 'pilot' ? '🚁' : '📋'}</div>
        <p className="text-gray-500 font-medium">
          {role === 'pilot' ? 'Sin asignaciones' : 'Sin operaciones'}
        </p>
        <p className="text-gray-400 text-sm mt-1">
          {role === 'pilot'
            ? 'Cuando un agricultor solicite un servicio, aparecera aqui.'
            : 'Solicita un servicio desde una alerta activa en tus parcelas.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
      {columns.map((col) => {
        const colOps = getColumnOps(col.key);
        return (
          <div key={col.key} className={`rounded-xl border border-gray-200 border-t-4 ${col.accent} ${col.headerBg} overflow-hidden`}>
            {/* Column header */}
            <div className="px-3 py-2.5 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{col.label}</span>
              {colOps.length > 0 && (
                <span className="bg-white text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-gray-200">
                  {colOps.length}
                </span>
              )}
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 min-h-[200px]">
              {colOps.length === 0 ? (
                <div className="h-24 flex items-center justify-center">
                  <p className="text-[11px] text-gray-400 text-center px-2">{col.emptyText}</p>
                </div>
              ) : (
                colOps.map((op) => (
                  <OperationCard
                    key={op._id}
                    op={op}
                    role={role}
                    onAccept={onAccept}
                    onReject={onReject}
                    isLoading={isLoading}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
