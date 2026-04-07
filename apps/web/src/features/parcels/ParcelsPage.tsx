import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import ParcelMap from './ParcelMap.js';
import NdviChart from './NdviChart.js';
import HealthScoreGauge from '@/components/HealthScoreGauge.js';

type NdviReading = { date: string; mean: number; min: number; max: number; anomalyDetected: boolean; source?: string };
type Parcel = {
  _id: string;
  name: string;
  cropType: string;
  areaHa: number;
  province: string;
  sigpacRef?: string;
  geometry: GeoJSON.Polygon;
  ndviHistory: NdviReading[];
};

function getHealthColor(ndvi: number | undefined) {
  if (ndvi === undefined) return 'text-gray-400';
  if (ndvi >= 0.55) return 'text-green-600';
  if (ndvi >= 0.40) return 'text-yellow-600';
  if (ndvi >= 0.30) return 'text-orange-600';
  return 'text-red-600';
}

export default function ParcelsPage() {
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: parcelsData, isLoading } = useQuery({
    queryKey: ['parcels', 'mine'],
    queryFn: async () => {
      const res = await api.get('/parcels/mine');
      return res.data.data;
    },
  });

  const parcels: Parcel[] = parcelsData || [];
  const selectedParcel = parcels.find((p) => p._id === selectedParcelId);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-[400px] bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Parcelas</h1>
          <p className="text-gray-500 text-sm mt-1">{parcels.length} parcelas · monitorizado via Sentinel-2</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/parcels/new')}
          className="bg-terra-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra-600 transition-colors"
        >
          + Nueva Parcela
        </button>
      </div>

      {/* Main layout: map left + list/detail right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* Map — sticky, takes left 3 cols */}
        <div className="lg:col-span-3 sticky top-6">
          <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 'calc(100vh - 180px)' }}>
            <ParcelMap
              parcels={parcels}
              selectedParcelId={selectedParcelId || undefined}
              focusParcelId={selectedParcelId || undefined}
              onParcelClick={setSelectedParcelId}
              height="100%"
              showDetailLink
              showLegend
            />
          </div>
        </div>

        {/* Right panel: unified white card with list + detail */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 180px)' }}>

          {/* List header */}
          <div className="px-4 pt-4 pb-2 border-b border-gray-100 flex-shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{parcels.length} parcelas</p>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* Parcel list — mini cards 2-col grid */}
        <div className="grid grid-cols-2 gap-2">
          {parcels.length === 0 ? (
            <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-400 text-sm mb-3">Sin parcelas registradas</p>
              <button
                onClick={() => navigate('/dashboard/parcels/new')}
                className="bg-terra-500 text-white text-xs px-4 py-2 rounded-lg hover:bg-terra-600 transition-colors font-medium"
              >
                Registrar primera parcela
              </button>
            </div>
          ) : (
            parcels.map((parcel) => {
              const latestNdvi = parcel.ndviHistory?.[parcel.ndviHistory.length - 1];
              const isSelected = parcel._id === selectedParcelId;
              const hasAlert = latestNdvi?.anomalyDetected || (latestNdvi && latestNdvi.mean < 0.3);
              const ndviColor = latestNdvi ? (latestNdvi.mean < 0.3 ? '#ef4444' : latestNdvi.mean < 0.4 ? '#f97316' : latestNdvi.mean < 0.55 ? '#eab308' : '#22c55e') : '#94a3b8';

              return (
                <button
                  key={parcel._id}
                  onClick={() => setSelectedParcelId(parcel._id)}
                  className={`text-left p-2.5 rounded-xl border-2 transition-all ${
                    isSelected ? 'border-brand-500 bg-brand-50' : 'border-gray-100 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h3 className="font-semibold text-gray-900 text-[11px] leading-tight truncate flex-1">{parcel.name}</h3>
                    {hasAlert && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 truncate">{parcel.province} · {parcel.areaHa} ha</p>
                  {latestNdvi ? (
                    <div className="flex items-center gap-1 mt-1.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ndviColor }} />
                      <span className="text-[11px] font-bold" style={{ color: ndviColor }}>
                        {latestNdvi.mean.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-300 mt-1">Sin NDVI</p>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Detail panel — inside the same white card, separated by divider */}
        <div className="border-t border-gray-100 pt-4">
          {selectedParcel ? (
            <div>
              {/* Detail header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedParcel.name}</h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {selectedParcel.cropType} · {selectedParcel.areaHa} ha · {selectedParcel.province}
                    {selectedParcel.sigpacRef && ` · SIGPAC: ${selectedParcel.sigpacRef}`}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/dashboard/parcels/${selectedParcel._id}`)}
                  className="bg-terra-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-terra-600 transition-colors font-semibold flex-shrink-0"
                >
                  Ver detalle completo →
                </button>
              </div>

              {/* Gauge + chart */}
              {selectedParcel.ndviHistory?.length > 0 ? (
                <div>
                  {/* Health score + stats row */}
                  <div className="flex items-center gap-6 mb-5 pb-4 border-b border-gray-100">
                    <HealthScoreGauge
                      ndvi={selectedParcel.ndviHistory[selectedParcel.ndviHistory.length - 1].mean}
                      size={100}
                      showLabel
                    />
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      {(() => {
                        const latest = selectedParcel.ndviHistory[selectedParcel.ndviHistory.length - 1];
                        const prev = selectedParcel.ndviHistory[selectedParcel.ndviHistory.length - 2];
                        const trend = prev ? latest.mean - prev.mean : null;
                        const anomalies = selectedParcel.ndviHistory.filter((r) => r.anomalyDetected).length;
                        return (
                          <>
                            <div>
                              <p className="text-xs text-gray-400">Ultima lectura</p>
                              <p className="text-sm font-semibold text-gray-900">{formatDate(latest.date)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Tendencia</p>
                              <p className={`text-sm font-semibold ${trend === null ? 'text-gray-400' : trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                {trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend.toFixed(3)}`}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Lecturas totales</p>
                              <p className="text-sm font-semibold text-gray-900">{selectedParcel.ndviHistory.length}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Anomalias</p>
                              <p className={`text-sm font-semibold ${anomalies > 0 ? 'text-red-600' : 'text-green-600'}`}>{anomalies}</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Evolucion NDVI</h3>
                  <NdviChart data={selectedParcel.ndviHistory} height={260} />
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-xl">
                  Sin datos NDVI disponibles aun
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <span className="text-gray-400 text-xl">🗺</span>
              </div>
              <p className="text-gray-500 font-medium">Selecciona una parcela</p>
              <p className="text-gray-400 text-xs mt-1">Haz click en el mapa o en la lista</p>
            </div>
          )}
        </div>

          </div>{/* end scrollable content */}
        </div>{/* end right panel */}
      </div>
    </div>
  );
}
