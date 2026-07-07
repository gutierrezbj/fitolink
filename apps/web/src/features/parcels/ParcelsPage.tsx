import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { cropLabel } from '@fitolink/shared';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import { toast } from '@/stores/toastStore.js';
import ParcelMap from './ParcelMap.js';
import ParcelExportButtons from './ParcelExportButtons.js';
import NdviChart from './NdviChart.js';
import HealthScoreGauge from '@/components/HealthScoreGauge.js';
import { ndviColor, ndviLowForCrop } from '@/lib/cropHealth.js';

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
  establishmentPhase?: boolean;
  calibratingUntil?: string | null;
};

function getHealthColor(ndvi: number | undefined) {
  if (ndvi === undefined) return 'text-gray-400';
  if (ndvi >= 0.55) return 'text-green-600';
  if (ndvi >= 0.40) return 'text-yellow-600';
  if (ndvi >= 0.30) return 'text-orange-600';
  return 'text-red-600';
}

// Chip de color por cultivo DECLARADO (el que dijo el agricultor en SIGPAC, no
// detección por satélite). Sirve para localizar de un vistazo, p.ej. el maíz.
const CROP_CHIP: Record<string, string> = {
  maiz: 'bg-amber-100 text-amber-800',
  cereal: 'bg-yellow-100 text-yellow-800',
  olivo: 'bg-green-100 text-green-800',
  leguminosa: 'bg-lime-100 text-lime-800',
  girasol: 'bg-amber-100 text-amber-800',
  citrico: 'bg-orange-100 text-orange-800',
  frutal: 'bg-rose-100 text-rose-800',
  vinedo: 'bg-purple-100 text-purple-800',
  pistacho: 'bg-emerald-100 text-emerald-800',
  almendro: 'bg-pink-100 text-pink-800',
  hortaliza: 'bg-teal-100 text-teal-800',
  arroz: 'bg-sky-100 text-sky-800',
  remolacha: 'bg-fuchsia-100 text-fuchsia-800',
  patata: 'bg-stone-100 text-stone-700',
  algodon: 'bg-slate-100 text-slate-700',
};
function cropChipClass(crop: string): string {
  return CROP_CHIP[crop] ?? 'bg-gray-100 text-gray-700';
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ParcelsPage() {
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [cropFilter, setCropFilter] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<'estado' | 'cultivo'>('estado');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: parcelsData, isLoading } = useQuery({
    queryKey: ['parcels', 'mine'],
    queryFn: async () => {
      const res = await api.get('/parcels/mine');
      return res.data.data;
    },
  });

  const parcels: Parcel[] = parcelsData || [];

  // Resumen por cultivo declarado (recuento + ha), ordenado por nº de parcelas.
  // Para ver "cuántas de maíz" sin cruzar con un excel aparte.
  const cropSummary = useMemo(() => {
    const m = new Map<string, { count: number; ha: number }>();
    for (const p of parcels) {
      const e = m.get(p.cropType) ?? { count: 0, ha: 0 };
      e.count += 1;
      e.ha += p.areaHa || 0;
      m.set(p.cropType, e);
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [parcels]);

  // Parcelas mostradas (lista + mapa) según el filtro de cultivo activo.
  const shownParcels = cropFilter ? parcels.filter((p) => p.cropType === cropFilter) : parcels;

  const selectedParcel = parcels.find((p) => p._id === selectedParcelId);
  const parcelToDelete = parcels.find((p) => p._id === confirmDeleteId);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/parcels/${id}`);
      return id;
    },
    onSuccess: (deletedId) => {
      toast.success('Parcela eliminada');
      if (selectedParcelId === deletedId) setSelectedParcelId(null);
      setConfirmDeleteId(null);
      void queryClient.invalidateQueries({ queryKey: ['parcels'] });
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } }; message?: string }) => {
      const msg = e.response?.data?.error?.message ?? e.message ?? 'No se ha podido eliminar';
      toast.error(msg);
      setConfirmDeleteId(null);
    },
  });

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
        <div className="flex items-center gap-2">
          {parcels.length > 0 && (
            <ParcelExportButtons
              parcels={parcels.map((p) => ({
                name: p.name,
                cropType: p.cropType,
                areaHa: p.areaHa,
                sigpacRef: p.sigpacRef,
                geometry: p.geometry,
              }))}
              filenameBase="mis-parcelas"
              docName={`Mis parcelas (${parcels.length})`}
            />
          )}
          <button
            onClick={() => navigate('/dashboard/parcels/new')}
            className="bg-terra-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-terra-600 transition-colors"
          >
            + Nueva Parcela
          </button>
        </div>
      </div>

      {/* Main layout: map left + list/detail right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* Map — sticky en lg (izquierda); en móvil altura fija menor y encima. */}
        <div className="lg:col-span-3 lg:sticky lg:top-6">
          <div className="relative rounded-xl overflow-hidden border border-gray-200 h-72 lg:h-[calc(100vh-180px)]">
            {/* Toggle de color del mapa: Estado (salud NDVI) / Cultivo. */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex rounded-full bg-white/95 shadow border border-gray-200 overflow-hidden text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setColorMode('estado')}
                className={`px-3 py-1 transition-colors ${colorMode === 'estado' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Estado
              </button>
              <button
                type="button"
                onClick={() => setColorMode('cultivo')}
                className={`px-3 py-1 transition-colors ${colorMode === 'cultivo' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Cultivo
              </button>
            </div>
            <ParcelMap
              parcels={shownParcels}
              selectedParcelId={selectedParcelId || undefined}
              focusParcelId={selectedParcelId || undefined}
              onParcelClick={setSelectedParcelId}
              height="100%"
              showDetailLink
              showLegend
              colorMode={colorMode}
            />
          </div>
        </div>

        {/* Right panel: en lg tiene su propio scroll interno; en móvil fluye. */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col lg:overflow-hidden lg:max-h-[calc(100vh-180px)]">

          {/* List header — los chips de cultivo son FILTROS clicables. */}
          <div className="px-4 pt-4 pb-2 border-b border-gray-100 flex-shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {cropFilter ? `${shownParcels.length} de ${parcels.length} parcelas` : `${parcels.length} parcelas`}
            </p>
            {cropSummary.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {cropSummary.map(([crop, s]) => {
                  const active = cropFilter === crop;
                  return (
                    <button
                      key={crop}
                      type="button"
                      onClick={() => setCropFilter(active ? null : crop)}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition ${cropChipClass(crop)} ${
                        active ? 'ring-2 ring-brand-500 ring-offset-1' : cropFilter ? 'opacity-40 hover:opacity-100' : 'hover:brightness-95'
                      }`}
                      title={`Filtrar: ${s.count} parcela${s.count > 1 ? 's' : ''} de ${cropLabel(crop)} declarado · ${s.ha.toFixed(2)} ha`}
                    >
                      {cap(cropLabel(crop))} {s.count} · {s.ha.toFixed(1)} ha
                    </button>
                  );
                })}
                {cropFilter && (
                  <button
                    type="button"
                    onClick={() => setCropFilter(null)}
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    ✕ Todas
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 lg:overflow-y-auto p-4 flex flex-col gap-4">

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
            shownParcels.map((parcel) => {
              const latestNdvi = parcel.ndviHistory?.[parcel.ndviHistory.length - 1];
              const isSelected = parcel._id === selectedParcelId;
              const hasAlert = latestNdvi?.anomalyDetected || ndviLowForCrop(latestNdvi?.mean, parcel.cropType);
              const dotColor = ndviColor(latestNdvi?.mean, parcel.cropType);

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
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`text-[9px] font-semibold px-1 py-px rounded flex-shrink-0 ${cropChipClass(parcel.cropType)}`}>
                      {cap(cropLabel(parcel.cropType))}
                    </span>
                    <span className="text-[10px] text-gray-400 truncate">{parcel.areaHa} ha</span>
                  </div>
                  {latestNdvi ? (
                    <div className="flex items-center gap-1 mt-1.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                      <span className="text-[11px] font-bold" style={{ color: dotColor }}>
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
              <div className="flex items-start justify-between mb-4 gap-2">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 truncate">{selectedParcel.name}</h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {selectedParcel.cropType} · {selectedParcel.areaHa} ha · {selectedParcel.province}
                    {selectedParcel.sigpacRef && ` · SIGPAC: ${selectedParcel.sigpacRef}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/dashboard/parcels/${selectedParcel._id}`)}
                    className="bg-terra-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-terra-600 transition-colors font-semibold"
                  >
                    Ver detalle →
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(selectedParcel._id)}
                    title="Eliminar parcela"
                    className="border border-red-200 text-red-600 hover:bg-red-50 text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h14" />
                      <path d="M8 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
                      <path d="M5 6l1 10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-10" />
                      <path d="M9 10v5M11 10v5" />
                    </svg>
                  </button>
                </div>
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
                      establishmentPhase={selectedParcel.establishmentPhase}
                      calibratingUntil={selectedParcel.calibratingUntil}
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
                  <NdviChart data={selectedParcel.ndviHistory} height={260} cropType={selectedParcel.cropType} />
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

      {/* Delete confirmation */}
      {parcelToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => deleteMutation.isPending ? null : setConfirmDeleteId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h14" />
                  <path d="M8 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
                  <path d="M5 6l1 10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-10" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">¿Eliminar esta parcela?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-semibold text-gray-700">{parcelToDelete.name}</span> dejará de
                  monitorizarse. Su histórico NDVI se conserva pero ya no aparecerá en el panel.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(parcelToDelete._id)}
                disabled={deleteMutation.isPending}
                className="bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
