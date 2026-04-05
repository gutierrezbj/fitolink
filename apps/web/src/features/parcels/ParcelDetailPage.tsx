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
    const ndvis = snapshot.points.map((p) => p.ndvi).filter(Number.isFinite);
    if (ndvis.length === 0) return null;
    const mean = ndvis.reduce((a, b) => a + b, 0) / ndvis.length;
    const min = Math.min(...ndvis);
    const max = Math.max(...ndvis);
    const spread = max - min;
    return { mean, min, max, spread };
  }, [snapshot.points]);

  if (!stats) return null;

  const interpretation =
    stats.mean < 0.20 ? 'Sin vegetacion activa — revisar urgente' :
    stats.mean < 0.30 ? 'Actividad vegetal muy baja — posible estres severo' :
    stats.mean < 0.40 ? 'Actividad vegetal baja — requiere atencion' :
    stats.mean < 0.50 ? 'Actividad vegetal moderada — monitorizar evolucion' :
    stats.mean < 0.65 ? 'Vegetacion activa y sana' :
    'Vegetacion en optimas condiciones';

  return (
    <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-gray-400">Sentinel-2 · {formatDate(snapshot.date)}</span>
      <span className="text-gray-500">min <b className="text-gray-700">{stats.min.toFixed(2)}</b></span>
      <span className="text-gray-500">media <b className="text-gray-700">{stats.mean.toFixed(2)}</b></span>
      <span className="text-gray-500">max <b className="text-gray-700">{stats.max.toFixed(2)}</b></span>
      <span className="text-gray-600 flex-1 min-w-full sm:min-w-0">{interpretation}</span>
    </div>
  );
}

export default function ParcelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: ndviSnapshot } = useNdviSnapshot(id);
  const [showHeatmap, setShowHeatmap] = useState(true);

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

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.patch(`/alerts/${alertId}`, { status: 'resolved', resolvedBy: 'farmer' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'parcel', id] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
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
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-all shadow-sm hover:shadow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Mis parcelas
        </button>
      </div>

      {/* HERO: Map full width with NDVI overlay */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="relative">
          <ParcelMap parcels={[parcel]} height="460px" showDetailLink={false}>
            {showHeatmap && ndviSnapshot && <NdviHeatmap snapshot={ndviSnapshot} parcelGeometry={parcel.geometry} />}
          </ParcelMap>


          {/* Top-right: toggle NDVI */}
          {ndviSnapshot && (
            <div className="absolute top-3 right-3 z-[1000]">
              <button
                onClick={() => setShowHeatmap((v) => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium shadow-sm transition-colors ${
                  showHeatmap
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
                }`}
              >
                Indice NDVI {showHeatmap ? 'activado' : 'desactivado'}
              </button>
            </div>
          )}

          {/* Bottom-right: legend */}
          {showHeatmap && ndviSnapshot && (
            <div className="absolute bottom-3 right-3 z-[1000]">
              <NdviLegend />
            </div>
          )}

          {/* Bottom-left: snapshot info */}
          {showHeatmap && ndviSnapshot && (
            <div className="absolute bottom-3 left-3 z-[1000] bg-black/50 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm">
              Sentinel-2 · {formatDate(ndviSnapshot.date)}
            </div>
          )}
        </div>

      </div>

      {/* Two-card row: gauge + interpretation */}
      {latestNdvi && (() => {
        const ndvi = latestNdvi.mean;
        const trend = ndviTrend ?? 0;
        const isDecline = trend < -0.02;
        const isCritical = ndvi < 0.35;
        const isAlert = ndvi < 0.50;
        const bg = isCritical ? 'bg-red-50 border-red-200' : isAlert ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200';
        const textColor = isCritical ? 'text-red-800' : isAlert ? 'text-orange-800' : 'text-green-800';
        const title = isCritical
          ? 'Estres vegetativo severo — atencion urgente'
          : isAlert
          ? 'Vegetacion debilitada — vigilar evolucion'
          : 'Cultivo en buen estado';

        // Spatial analysis from heatmap grid
        let spatialNote = '';
        if (ndviSnapshot && ndviSnapshot.points.length > 8) {
          const pts = ndviSnapshot.points.filter((p) => Number.isFinite(p.ndvi));
          if (pts.length > 8) {
            const lats = pts.map((p) => p.lat);
            const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
            const northPts = pts.filter((p) => p.lat >= midLat);
            const southPts = pts.filter((p) => p.lat < midLat);
            const northMean = northPts.reduce((a, b) => a + b.ndvi, 0) / northPts.length;
            const southMean = southPts.reduce((a, b) => a + b.ndvi, 0) / southPts.length;
            const diff = Math.abs(northMean - southMean);
            if (diff > 0.12) {
              const weakZone = northMean < southMean ? 'norte' : 'sur';
              const strongZone = northMean < southMean ? 'sur' : 'norte';
              const weakVal = Math.min(northMean, southMean).toFixed(2);
              const strongVal = Math.max(northMean, southMean).toFixed(2);
              spatialNote = `El mapa muestra un gradiente claro: zona ${weakZone} con actividad reducida (NDVI ${weakVal}) frente a zona ${strongZone} en mejor estado (NDVI ${strongVal}). Posible diferencia de suelo, humedad o densidad de plantacion.`;
            } else {
              const stressPct = Math.round((pts.filter((p) => p.ndvi < 0.35).length / pts.length) * 100);
              if (stressPct > 50) {
                spatialNote = `El estres esta distribuido de forma uniforme en toda la parcela (${stressPct}% de los pixeles con NDVI < 0.35). Sugiere causa generalizada: sequia, enfermedad o carencia nutricional.`;
              } else if (stressPct > 15) {
                spatialNote = `Zonas de estres localizadas (${stressPct}% de la parcela). El resto mantiene actividad vegetal normal.`;
              } else {
                spatialNote = `La actividad vegetal es uniforme en toda la parcela. No se detectan patrones espaciales de estres.`;
              }
            }
          }
        }

        const body = isCritical
          ? `NDVI ${ndvi.toFixed(3)}${isDecline ? `, bajando ${Math.abs(trend).toFixed(3)} puntos` : ''}. Perdida severa de actividad vegetal. Posible plaga, hongo, sequia o dano mecanico.`
          : isAlert
          ? `NDVI ${ndvi.toFixed(3)} en zona de atencion${isDecline ? ', con tendencia descendente' : ''}. Monitorizar en los proximos 10-15 dias.`
          : `NDVI ${ndvi.toFixed(3)}. Vegetacion activa y saludable${isDecline ? ', aunque con ligera tendencia a la baja' : ''}.`;

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Card 1: Health gauge + stats */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-5">
              <HealthScoreGauge ndvi={ndvi} size={100} showLabel />
              <div className="flex-1 grid grid-cols-2 gap-y-3">
                <div>
                  <p className="text-xs text-gray-400">Tendencia</p>
                  <p className={`text-lg font-bold ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {trend > 0 ? '+' : ''}{trend.toFixed(3)}
                  </p>
                  <p className="text-xs text-gray-400">{trend > 0 ? 'Mejorando' : trend < 0 ? 'Bajando' : 'Estable'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Alertas activas</p>
                  <p className={`text-lg font-bold ${activeAlerts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{activeAlerts.length}</p>
                  <p className="text-xs text-gray-400">{activeAlerts.length > 0 ? 'Requieren atencion' : 'Todo en orden'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Lecturas satelite</p>
                  <p className="text-lg font-bold text-gray-900">{parcel.ndviHistory?.length || 0}</p>
                  <p className="text-xs text-gray-400">{anomalyCount} anomalia{anomalyCount !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Ultima lectura</p>
                  <p className="text-sm font-semibold text-gray-700">{formatDate(latestNdvi.date)}</p>
                  <p className="text-xs text-gray-400">Sentinel-2</p>
                </div>
              </div>
            </div>

            {/* Card 2: Interpretation + spatial analysis + CTA */}
            <div className={`rounded-xl border p-5 flex flex-col justify-between ${bg}`}>
              <div>
                <p className={`text-sm font-semibold mb-1 ${textColor}`}>{title}</p>
                <p className={`text-xs leading-relaxed ${textColor} opacity-90 mb-2`}>{body}</p>
                {spatialNote && (
                  <p className={`text-xs leading-relaxed ${textColor} opacity-75 border-t border-current border-opacity-20 pt-2`}>
                    {spatialNote}
                  </p>
                )}
              </div>
              {(isCritical || isAlert) && activeAlerts.length > 0 && (
                <button
                  onClick={() => requestServiceMutation.mutate(activeAlerts[0])}
                  disabled={requestServiceMutation.isPending}
                  className="mt-4 bg-brand-600 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium w-full"
                >
                  Solicitar dron
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* NDVI Chart — compact */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Evolucion NDVI historica</h2>
          <span className="text-xs text-gray-400">Sentinel-2 · cada 5 dias</span>
        </div>
        {parcel.ndviHistory?.length > 0 ? (
          <NdviChart data={parcel.ndviHistory} height={220} />
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
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
                        onClick={() => resolveAlertMutation.mutate(alert._id)}
                        disabled={resolveAlertMutation.isPending}
                        className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium whitespace-nowrap"
                      >
                        Ya lo atendi
                      </button>
                      <button
                        onClick={() => falsePosiveMutation.mutate(alert._id)}
                        disabled={falsePosiveMutation.isPending}
                        className="border border-gray-200 text-gray-400 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
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
