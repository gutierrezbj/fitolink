import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import ParcelMap from '@/features/parcels/ParcelMap.js';
import HealthScoreGauge from '@/components/HealthScoreGauge.js';

const RISK_COLORS: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-50',
  high: 'border-l-orange-500 bg-orange-50',
  medium: 'border-l-yellow-500 bg-yellow-50',
  low: 'border-l-green-500 bg-green-50',
};

const RISK_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const RISK_LABELS: Record<string, string> = {
  critical: 'Critico', high: 'Alto', medium: 'Medio', low: 'Bajo',
};

function riskLevel(ndvi: number): string {
  if (ndvi < 0.30) return 'critical';
  if (ndvi < 0.40) return 'high';
  if (ndvi < 0.55) return 'medium';
  return 'low';
}

type Parcel = {
  _id: string;
  name: string;
  cropType: string;
  province: string;
  area?: number;
  areaHa?: number;
  geometry?: object;
  ndviHistory?: { mean: number; date: string; anomalyDetected?: boolean }[];
  isActive: boolean;
};

export default function B2BParcelsPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Parcel | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const { data: parcels = [], isLoading } = useQuery({
    queryKey: ['b2b', 'parcels'],
    queryFn: async () => { const res = await api.get('/parcels'); return res.data.data ?? []; },
    refetchInterval: 60_000,
  });

  const filtered: Parcel[] = filter === 'all'
    ? parcels
    : parcels.filter((p: Parcel) => {
        const ndvi = p.ndviHistory?.at(-1)?.mean;
        return ndvi !== undefined && riskLevel(ndvi) === filter;
      });

  const counts = {
    all: parcels.length,
    critical: parcels.filter((p: Parcel) => { const n = p.ndviHistory?.at(-1)?.mean; return n !== undefined && n < 0.30; }).length,
    high: parcels.filter((p: Parcel) => { const n = p.ndviHistory?.at(-1)?.mean; return n !== undefined && n >= 0.30 && n < 0.40; }).length,
    medium: parcels.filter((p: Parcel) => { const n = p.ndviHistory?.at(-1)?.mean; return n !== undefined && n >= 0.40 && n < 0.55; }).length,
    low: parcels.filter((p: Parcel) => { const n = p.ndviHistory?.at(-1)?.mean; return n !== undefined && n >= 0.55; }).length,
  };

  const selNdvi = selected?.ndviHistory?.at(-1)?.mean;
  const selRisk = selNdvi !== undefined ? riskLevel(selNdvi) : 'low';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Parcelas Aseguradas</h1>
          <p className="text-sm text-gray-500">{parcels.length} parcelas en cartera</p>
        </div>
      </div>

      {/* Risk filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === f
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {f === 'all' ? 'Todas' : RISK_LABELS[f]}
            <span className={`ml-1.5 ${filter === f ? 'text-gray-300' : 'text-gray-400'}`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* List */}
        <div className="lg:col-span-1 space-y-2">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <p className="text-3xl mb-3">🛡️</p>
              <p className="text-sm">No hay parcelas en este nivel de riesgo</p>
            </div>
          )}

          {filtered.map((parcel: Parcel) => {
            const ndvi = parcel.ndviHistory?.at(-1)?.mean;
            const risk = ndvi !== undefined ? riskLevel(ndvi) : 'low';
            const lastDate = parcel.ndviHistory?.at(-1)?.date;
            const anomaly = parcel.ndviHistory?.at(-1)?.anomalyDetected;

            return (
              <button
                key={parcel._id}
                onClick={() => setSelected(parcel)}
                className={`w-full text-left border-l-4 ${RISK_COLORS[risk]} rounded-r-xl p-3 border border-gray-100 transition-shadow ${
                  selected?._id === parcel._id ? 'ring-2 ring-blue-400' : 'hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{parcel.name}</p>
                      {anomaly && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-500">{parcel.cropType} · {parcel.province}</p>
                    {lastDate && (
                      <p className="text-[11px] text-gray-400 mt-0.5">Ultima lectura: {formatDate(lastDate)}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {ndvi !== undefined && (
                      <span className="text-sm font-bold text-gray-800">{ndvi.toFixed(3)}</span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${RISK_BADGE[risk]}`}>
                      {RISK_LABELS[risk]}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail / map panel */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                  <p className="text-sm text-gray-500">{selected.cropType} · {selected.province}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${RISK_BADGE[selRisk]}`}>
                    Riesgo {RISK_LABELS[selRisk]}
                  </span>
                  <button
                    onClick={() => navigate(`/dashboard/parcels/${selected._id}`)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Ver detalle →
                  </button>
                </div>
              </div>

              {/* NDVI gauge */}
              {selNdvi !== undefined && (
                <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-xl">
                  <HealthScoreGauge ndvi={selNdvi} size={100} showLabel />
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">NDVI actual</p>
                      <p className="text-2xl font-bold text-gray-900">{selNdvi.toFixed(3)}</p>
                    </div>
                    {selected.area && (
                      <div>
                        <p className="text-xs text-gray-500">Superficie asegurada</p>
                        <p className="text-sm font-semibold text-gray-700">{selected.area} ha</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500">Lecturas NDVI</p>
                      <p className="text-sm font-semibold text-gray-700">{selected.ndviHistory?.length ?? 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mini map */}
              {selected.geometry && (
                <ParcelMap
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  parcels={[selected] as any}
                  height="240px"
                  showDetailLink={false}
                />
              )}
            </div>
          ) : (
            <div className="h-full min-h-64 flex flex-col items-center justify-center text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <p className="text-3xl mb-3">🗺️</p>
              <p className="text-sm font-medium text-gray-500">Selecciona una parcela</p>
              <p className="text-xs mt-1">para ver el detalle y el mapa</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
