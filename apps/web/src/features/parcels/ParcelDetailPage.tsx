import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import type { NdviSnapshot } from './useNdviSnapshot.js';
import NdviChart from './NdviChart.js';
import HealthScoreGauge from '@/components/HealthScoreGauge.js';
import ParcelMap from './ParcelMap.js';
import NdviHeatmap from './NdviHeatmap.js';
import NdviLegend from './NdviLegend.js';
import { useNdviSnapshot } from './useNdviSnapshot.js';

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
};

const SEVERITY_LABELS = { critical: 'Critica', high: 'Alta', medium: 'Media', low: 'Baja' };
const STATUS_LABELS = { new: 'Nueva', notified: 'Notificada', acknowledged: 'Revisada', resolved: 'Resuelta' };

type Severity = keyof typeof SEVERITY_COLORS;

type Alert = {
  _id: string;
  type: string;
  severity: Severity;
  status: keyof typeof STATUS_LABELS;
  ndviValue: number;
  ndviDelta: number;
  aiConfidence: number;
  detectedAt: string;
};

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
  isInsured: boolean;
};

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function NdviHeatmapSummary({ snapshot }: { snapshot: NdviSnapshot }) {
  const stats = useMemo(() => {
    const ndvis = snapshot.points.map((p) => p.ndvi);
    const mean = ndvis.reduce((a, b) => a + b, 0) / ndvis.length;
    const min = Math.min(...ndvis);
    const max = Math.max(...ndvis);
    const stressPct = Math.round((ndvis.filter((n) => n < 0.35).length / ndvis.length) * 100);
    return { mean, min, max, stressPct };
  }, [snapshot.points]);

  const interpretation =
    stats.stressPct > 60 ? 'Estres vegetativo severo en la mayor parte de la parcela' :
    stats.stressPct > 30 ? `Estres vegetativo en el ${stats.stressPct}% de la parcela — requiere atencion` :
    stats.stressPct > 10 ? `Zonas de estres localizadas (${stats.stressPct}%) — monitorizar` :
    'Vegetacion en buen estado en toda la parcela';

  return (
    <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-gray-400">Sentinel-2 · {formatDate(snapshot.date)}</span>
      <span className="text-gray-500">NDVI min <b className="text-gray-700">{stats.min.toFixed(2)}</b></span>
      <span className="text-gray-500">max <b className="text-gray-700">{stats.max.toFixed(2)}</b></span>
      <span className="text-gray-500">media <b className="text-gray-700">{stats.mean.toFixed(2)}</b></span>
      {stats.stressPct > 0 && (
        <span className={`font-medium ${stats.stressPct > 30 ? 'text-red-600' : 'text-yellow-600'}`}>
          {stats.stressPct}% en estres
        </span>
      )}
      <span className="text-gray-600 flex-1 min-w-full sm:min-w-0">{interpretation}</span>
    </div>
  );
}

export default function ParcelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showHeatmap, setShowHeatmap] = useState(false);
  const { data: ndviSnapshot } = useNdviSnapshot(id);

  const { data: parcel, isLoading: loadingParcel } = useQuery<Parcel>({
    queryKey: ['parcel', id],
    queryFn: async () => {
      const res = await api.get(`/parcels/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: alertsData, isLoading: loadingAlerts } = useQuery<Alert[]>({
    queryKey: ['alerts', 'parcel', id],
    queryFn: async () => {
      const res = await api.get(`/alerts/parcel/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const requestServiceMutation = useMutation({
    mutationFn: async (alert: Alert) => {
      await api.post('/operations', { parcelId: id, type: 'phytosanitary', alertId: alert._id });
      await api.patch(`/alerts/${alert._id}`, { status: 'acknowledged' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'parcel', id] });
    },
  });

  const falsePosiveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.patch(`/alerts/${alertId}`, { status: 'resolved', resolvedBy: 'false_positive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'parcel', id] });
    },
  });

  if (loadingParcel) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-64 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!parcel) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Parcela no encontrada</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-brand-600 text-sm hover:underline">
          Volver
        </button>
      </div>
    );
  }

  const alerts = alertsData || [];
  const activeAlerts = alerts.filter((a) => a.status === 'new' || a.status === 'notified');
  const latestNdvi = parcel.ndviHistory?.[parcel.ndviHistory.length - 1];
  const prevNdvi = parcel.ndviHistory?.[parcel.ndviHistory.length - 2];
  const ndviTrend = latestNdvi && prevNdvi ? latestNdvi.mean - prevNdvi.mean : null;
  const anomalyCount = parcel.ndviHistory?.filter((r) => r.anomalyDetected).length || 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
        >
          ← Volver
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{parcel.name}</h1>
            {activeAlerts.length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse">
                {activeAlerts.length} alerta{activeAlerts.length > 1 ? 's' : ''}
              </span>
            )}
            {parcel.isInsured && (
              <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                Asegurada
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            {parcel.cropType} · {parcel.province} · {parcel.areaHa} ha
            {parcel.sigpacRef && ` · SIGPAC: ${parcel.sigpacRef}`}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="NDVI Actual"
          value={latestNdvi ? latestNdvi.mean.toFixed(3) : '—'}
          sub={latestNdvi ? formatDate(latestNdvi.date) : 'Sin lecturas'}
          accent={latestNdvi ? (latestNdvi.mean < 0.3 ? 'text-red-600' : latestNdvi.mean < 0.5 ? 'text-yellow-600' : 'text-green-600') : undefined}
        />
        <StatCard
          label="Tendencia"
          value={ndviTrend !== null ? `${ndviTrend > 0 ? '+' : ''}${ndviTrend.toFixed(3)}` : '—'}
          sub={ndviTrend !== null ? (ndviTrend > 0 ? 'Mejorando' : ndviTrend < 0 ? 'Bajando' : 'Estable') : undefined}
          accent={ndviTrend !== null ? (ndviTrend > 0 ? 'text-green-600' : ndviTrend < 0 ? 'text-red-600' : 'text-gray-600') : undefined}
        />
        <StatCard
          label="Alertas activas"
          value={String(activeAlerts.length)}
          sub={activeAlerts.length > 0 ? 'Requieren atencion' : 'Todo en orden'}
          accent={activeAlerts.length > 0 ? 'text-red-600' : 'text-green-600'}
        />
        <StatCard
          label="Lecturas NDVI"
          value={String(parcel.ndviHistory?.length || 0)}
          sub={`${anomalyCount} anomali${anomalyCount === 1 ? 'a' : 'as'} historicas`}
        />
      </div>

      {/* Map + Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Ubicacion</h2>
              {ndviSnapshot && (
                <button
                  onClick={() => setShowHeatmap((v) => !v)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                    showHeatmap
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700'
                  }`}
                >
                  <img src="/location.svg" alt="" className="w-3.5 h-3.5" />
                  Mapa NDVI
                </button>
              )}
            </div>
            <div className="relative">
              <ParcelMap
                parcels={[parcel]}
                height="280px"
                showDetailLink={false}
              >
                {showHeatmap && ndviSnapshot && (
                  <NdviHeatmap snapshot={ndviSnapshot} />
                )}
              </ParcelMap>
              {showHeatmap && ndviSnapshot && (
                <div className="absolute bottom-3 right-3 z-[1000]">
                  <NdviLegend />
                </div>
              )}
            </div>
            {showHeatmap && ndviSnapshot && (
              <NdviHeatmapSummary snapshot={ndviSnapshot} />
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center justify-center h-full">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Indice de Salud</h2>
            <HealthScoreGauge
              ndvi={latestNdvi?.mean ?? null}
              size={140}
              showLabel
            />
            {latestNdvi && (
              <div className="mt-4 w-full space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>Minimo</span><span className="font-medium text-gray-700">{latestNdvi.min.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Maximo</span><span className="font-medium text-gray-700">{latestNdvi.max.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Fuente</span><span className="font-medium text-gray-700 uppercase">{latestNdvi.source || 'Sentinel-2'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Farmer interpretation block */}
      {latestNdvi && (() => {
        const ndvi = latestNdvi.mean;
        const trend = ndviTrend ?? 0;
        const isDecline = trend < -0.02;
        const isCritical = ndvi < 0.30;
        const isAlert = ndvi < 0.40;
        const bg = isCritical ? 'bg-red-50 border-red-200' : isAlert ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200';
        const textColor = isCritical ? 'text-red-800' : isAlert ? 'text-orange-800' : 'text-green-800';
        const title = isCritical
          ? 'Estres vegetativo critico — su cultivo necesita atencion urgente'
          : isAlert
          ? 'Vegetacion debilitada — vigilar evolucion en proximas semanas'
          : 'Cultivo en buen estado — continuar seguimiento habitual';
        const body = isCritical
          ? `El NDVI ha caido a ${ndvi.toFixed(3)}${isDecline ? `, bajando ${Math.abs(trend).toFixed(3)} puntos en el ultimo periodo` : ''}. Esto indica perdida severa de actividad vegetal. Puede deberse a plaga, enfermedad fungica, deficit hidrico o dano mecanico.`
          : isAlert
          ? `El NDVI de ${ndvi.toFixed(3)} esta en la zona de atencion${isDecline ? ' y sigue bajando' : ''}. Monitorizar en los proximos 10-15 dias.`
          : `El NDVI de ${ndvi.toFixed(3)} indica vegetacion activa y saludable.`;
        return (
          <div className={`rounded-xl border p-4 mb-6 ${bg}`}>
            <p className={`text-sm font-semibold mb-1 ${textColor}`}>{title}</p>
            <p className={`text-xs ${textColor} opacity-80`}>{body}</p>
            {(isCritical || isAlert) && (
              <p className="text-xs mt-2 font-medium text-gray-600">
                Recomendacion: solicitar inspeccion con dron multiespectral para localizar las zonas afectadas y planificar el tratamiento.
              </p>
            )}
          </div>
        );
      })()}

      {/* NDVI Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Evolucion NDVI</h2>
          <span className="text-xs text-gray-400">Sentinel-2 · cada 5 dias</span>
        </div>
        {parcel.ndviHistory?.length > 0 ? (
          <NdviChart data={parcel.ndviHistory} height={320} />
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
            Sin datos NDVI disponibles aun
          </div>
        )}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Historial de Alertas
            {activeAlerts.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {activeAlerts.length} activa{activeAlerts.length > 1 ? 's' : ''}
              </span>
            )}
          </h2>

          <div className="space-y-3">
            {alerts.map((alert) => {
              const isActive = alert.status === 'new' || alert.status === 'notified';
              return (
                <div
                  key={alert._id}
                  className={`flex items-start gap-4 p-4 rounded-xl border-l-4 ${
                    isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-70'
                  } border-l-${alert.severity === 'critical' ? 'red' : alert.severity === 'high' ? 'orange' : alert.severity === 'medium' ? 'yellow' : 'blue'}-500`}
                  style={{
                    borderLeftColor:
                      alert.severity === 'critical' ? '#ef4444' :
                      alert.severity === 'high' ? '#f97316' :
                      alert.severity === 'medium' ? '#eab308' : '#3b82f6',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${SEVERITY_COLORS[alert.severity]}`}>
                        {SEVERITY_LABELS[alert.severity]}
                      </span>
                      <span className="text-xs text-gray-400">{STATUS_LABELS[alert.status]}</span>
                      <span className="text-xs text-gray-400 ml-auto">{formatDate(alert.detectedAt)}</span>
                    </div>

                    <div className="flex items-baseline gap-3 mb-2">
                      <span className="text-lg font-bold text-gray-900">{alert.ndviValue.toFixed(3)}</span>
                      <span className={`text-sm font-medium ${alert.ndviDelta < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {alert.ndviDelta > 0 ? '+' : ''}{alert.ndviDelta.toFixed(3)}
                      </span>
                      <span className="text-xs text-gray-400">NDVI</span>
                    </div>

                    {/* AI Confidence bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 w-16 flex-shrink-0">IA confianza</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${alert.aiConfidence > 0.7 ? 'bg-red-500' : alert.aiConfidence > 0.4 ? 'bg-orange-400' : 'bg-yellow-400'}`}
                          style={{ width: `${alert.aiConfidence * 100}%`, transition: 'width 0.6s ease' }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-500 font-medium w-8 text-right">
                        {Math.round(alert.aiConfidence * 100)}%
                      </span>
                    </div>
                  </div>

                  {isActive && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => requestServiceMutation.mutate(alert)}
                        disabled={requestServiceMutation.isPending}
                        className="bg-brand-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium whitespace-nowrap"
                      >
                        Solicitar servicio
                      </button>
                      <button
                        onClick={() => falsePosiveMutation.mutate(alert._id)}
                        disabled={falsePosiveMutation.isPending}
                        className="border border-gray-200 text-gray-500 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        Falso positivo
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
