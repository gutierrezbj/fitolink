import { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import { inferCoverLevel, cropLabel } from '@fitolink/shared';
import type { NdviSnapshot } from './useNdviSnapshot.js';
import NdviChart from './NdviChart.js';
import HealthScoreGauge from '@/components/HealthScoreGauge.js';
import ParcelMap from './ParcelMap.js';
import NdviHeatmap from './NdviHeatmap.js';
import NdviLegend from './NdviLegend.js';
import MpcContextWidget from './MpcContextWidget.js';
import NdviForecastCard from './NdviForecastCard.js';
import WeatherEventsCard from './WeatherEventsCard.js';
import PestAdvisoriesCard from './PestAdvisoriesCard.js';
import WeatherWidget from '@/features/weather/WeatherWidget.js';
import { polygonCentroid } from '@/features/marketplace/distance.js';
import { useNdviSnapshot } from './useNdviSnapshot.js';

// ── Seasonal baselines per crop group ───────────────────────────────────────
const SEASONAL_RANGE: Record<string, [number, number][]> = {
  // [min_normal, max_normal] indexed month 0=Jan … 11=Dec
  evergreen: [
    [0.32,0.62],[0.33,0.63],[0.35,0.65],[0.38,0.68],[0.40,0.70],[0.38,0.68],
    [0.35,0.65],[0.33,0.63],[0.34,0.64],[0.34,0.64],[0.32,0.62],[0.31,0.61],
  ],
  deciduous: [
    [0.08,0.25],[0.08,0.28],[0.10,0.35],[0.18,0.48],[0.38,0.65],[0.48,0.72],
    [0.52,0.75],[0.50,0.73],[0.42,0.68],[0.28,0.58],[0.12,0.35],[0.08,0.26],
  ],
  winter_annual: [
    [0.22,0.50],[0.30,0.58],[0.40,0.68],[0.45,0.72],[0.30,0.62],[0.12,0.30],
    [0.10,0.22],[0.10,0.20],[0.12,0.25],[0.15,0.32],[0.18,0.40],[0.20,0.46],
  ],
  summer_annual: [
    [0.08,0.20],[0.08,0.20],[0.10,0.22],[0.12,0.30],[0.22,0.48],[0.40,0.65],
    [0.48,0.72],[0.45,0.70],[0.30,0.60],[0.12,0.30],[0.08,0.22],[0.08,0.20],
  ],
};

const CROP_GROUP: Record<string, keyof typeof SEASONAL_RANGE> = {
  olivo: 'evergreen', citrico: 'evergreen', almendro: 'deciduous', pistacho: 'deciduous',
  vinedo: 'deciduous', frutal: 'deciduous',
  cereal: 'winter_annual', leguminosa: 'winter_annual', remolacha: 'winter_annual', patata: 'winter_annual',
  girasol: 'summer_annual', maiz: 'summer_annual', algodon: 'summer_annual', arroz: 'summer_annual',
};

const CROP_LABELS: Record<string, string> = {
  olivo: 'Olivar', vinedo: 'Viñedo', cereal: 'Cereal', girasol: 'Girasol',
  almendro: 'Almendro', pistacho: 'Pistacho', frutal: 'Frutal', citrico: 'Cítrico', maiz: 'Maíz',
  algodon: 'Algodón', arroz: 'Arroz', leguminosa: 'Leguminosa',
  remolacha: 'Remolacha', patata: 'Patata', hortaliza: 'Hortaliza', otro: 'Cultivo',
};

function getSeasonalRange(cropType: string, month: number): [number, number] | null {
  const group = CROP_GROUP[cropType];
  if (!group) return null;
  return SEASONAL_RANGE[group][month - 1];
}

function buildSeasonalNote(ndvi: number, cropType: string, month: number): string {
  const range = getSeasonalRange(cropType, month);
  if (!range) return '';
  const [lo, hi] = range;
  const crop = CROP_LABELS[cropType] || 'Cultivo';
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const mes = monthNames[month - 1];
  if (ndvi >= lo && ndvi <= hi) {
    return `Rango estacional normal para ${crop} en ${mes} (${lo.toFixed(2)}–${hi.toFixed(2)}). Sin anomalia estacional.`;
  }
  if (ndvi < lo) {
    const pct = Math.round(((lo - ndvi) / lo) * 100);
    return `${crop} en ${mes} deberia estar entre ${lo.toFixed(2)}–${hi.toFixed(2)}. El valor actual esta un ${pct}% por debajo del minimo estacional esperado.`;
  }
  return '';
}

function buildCauseNote(ndvi: number, cropType: string, month: number, range: number): string {
  const group = CROP_GROUP[cropType] ?? 'other';
  const seasonal = getSeasonalRange(cropType, month);
  const isSeasonallyLow = seasonal ? ndvi < seasonal[0] : ndvi < 0.35;
  const isHeterogeneous = range > 0.40;

  if (!isSeasonallyLow && !isHeterogeneous) return '';

  const causes: string[] = [];

  // Crop + season specific causes
  if (group === 'evergreen') {
    if (month >= 3 && month <= 5) causes.push('helada tardia (muy frecuente en meseta en marzo-abril)');
    if (month >= 6 && month <= 9) causes.push('estres hidrico por sequia estival');
    causes.push('verticillium dahliae (marchitez del olivo)', 'repilo (Spilocaea oleagina)');
  } else if (group === 'deciduous') {
    if (month >= 5 && month <= 9) {
      causes.push('mildiu o oidio', 'estres hidrico', 'cicadela (Scaphoideus titanus en viñedo)');
    }
    if (month >= 3 && month <= 5) causes.push('helada en brotacion', 'excoriosis');
  } else if (group === 'winter_annual') {
    if (month >= 2 && month <= 5) causes.push('roya amarilla (Puccinia striiformis)', 'sequia primaveral', 'carencia de nitrogeno');
    if (month >= 6 && month <= 8) causes.push('paraje normal post-cosecha');
  } else if (group === 'summer_annual') {
    if (month >= 6 && month <= 9) causes.push('deficiencia hidrica', 'trips o araña roja', 'fusarium');
  }

  if (isHeterogeneous) {
    causes.unshift('distribucion heterogenea — posible causa localizada (zona baja, suelo variable, foco de enfermedad)');
  }

  if (causes.length === 0) return '';
  return `Causas probables: ${causes.slice(0, 3).join('; ')}.`;
}

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

type NdviReading = {
  date: string;
  mean: number;
  min: number;
  max: number;
  anomalyDetected: boolean;
  source?: string;
  ndreValue?: number;
  ndmiValue?: number;
  eviValue?: number;
  saviValue?: number;
  cloudFraction?: number;
};

type ModisBaseline = {
  source: string;
  years: number;
  computed: string;
  months: { month: number; mean: number; std: number; n: number }[];
  allTimeMean: number;
  observationCount: number;
};

type ClimateBaseline = {
  source: string;
  period: string;
  computed: string;
  months: { month: number; precip: number; tmax: number; tmin: number; pdsi?: number; pet?: number }[];
  annualPrecip: number;
  annualPet?: number;
  aridityIndex?: number;
};

type Thermal = {
  source: string;
  days: number;
  lstC: number;
  airTempC?: number | null;
  lstDeltaAirC?: number | null;
  scenesUsed: number;
  lastDate?: string | null;
};

type RecentClimate = {
  source: string;
  days: number;
  fetched: string;
  precipTotalMm: number;
  tempMeanC?: number;
  tempMaxC?: number;
  tempMinC?: number;
  et0TotalMm?: number;
  daysWithRain: number;
  lastRainDaysAgo?: number;
  precipPctOfNormal?: number;
  precipAnomalyMm?: number;
  tempAnomalyC?: number;
  droughtFlag?: 'none' | 'mild' | 'moderate' | 'severe';
};

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
  establishmentPhase?: boolean;
  modisBaseline?: ModisBaseline;
  climateBaseline?: ClimateBaseline;
  recentClimate?: RecentClimate;
  thermal?: Thermal;
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
  const [serviceModal, setServiceModal] = useState<{ alert: Alert } | null>(null);
  const [serviceStep, setServiceStep] = useState<1 | 2>(1);
  const [serviceType, setServiceType] = useState<'inspection' | 'phytosanitary'>('inspection');
  const [serviceNotes, setServiceNotes] = useState('');

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
    mutationFn: async ({ alert, type, notes }: { alert: Alert; type: string; notes: string }) => {
      await api.post('/operations', { parcelId: id, type, alertId: alert._id, notes });
      await api.patch(`/alerts/${alert._id}`, { status: 'acknowledged' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'parcel', id] });
      queryClient.invalidateQueries({ queryKey: ['operations', 'mine'] });
      setServiceModal(null);
      setServiceStep(1);
      setServiceNotes('');
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

      {/* Aviso primera pasada — la parcela acaba de crearse y aún no hay
          NDVI. El pipeline corre cron y Sentinel-2 tiene revisita de 5 días,
          así que el usuario puede tardar entre 1 y 5 días en ver datos.
          Mostramos un mensaje claro AgroM-style para no asustar. Cuando
          llegue la primera lectura, ndviHistory.length > 0 y este bloque
          desaparece. */}
      {(parcel.ndviHistory?.length ?? 0) === 0 && (
        <div className="bg-earth-100/50 border border-earth-300/40 rounded-xl px-5 py-4 mb-4 flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-700 text-white flex items-center justify-center font-display text-lg">
            ⌛
          </div>
          <div className="flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500 mb-1">
              § PROCESANDO PRIMERA PASADA
            </p>
            <p className="font-display text-base text-brand-700 font-semibold leading-snug">
              Esperando el primer paso de Sentinel-2 sobre su parcela.
            </p>
            <p className="text-sm text-brand-900 mt-1.5 leading-relaxed">
              El satélite europeo Sentinel-2 pasa cada 5 días sobre la
              península. Cuando capte su parcela, generamos el primer
              informe automáticamente y lo recibirá en el digest matutino
              de las 7. Sin acción requerida de su parte.
            </p>
          </div>
        </div>
      )}

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
        const ndviMin = latestNdvi.min ?? ndvi;
        const ndviMax = latestNdvi.max ?? ndvi;
        const ndviRange = ndviMax - ndviMin;
        const trend = ndviTrend ?? 0;
        const isDecline = trend < -0.02;
        const month = new Date(latestNdvi.date).getMonth() + 1;
        const cropType = parcel.cropType || 'otro';

        // Seasonal awareness + crop context.
        // En parcelas en establecimiento (establishmentPhase=true) o con NDVI
        // fisiológicamente bajo (<0.30), los umbrales absolutos producen
        // falsos positivos: el cultivo joven SIEMPRE estará "bajo umbral"
        // hasta completar cobertura. Cambiamos a etiqueta neutra que NO
        // induce intervención innecesaria.
        const seasonalRange = getSeasonalRange(cropType, month);
        const isSeasonallyNormal = seasonalRange ? ndvi >= seasonalRange[0] && ndvi <= seasonalRange[1] : false;
        const coverLevel = inferCoverLevel({ ndvi, establishmentPhase: parcel.establishmentPhase });
        const isEstablishing = coverLevel === 'low';
        const isCritical = !isSeasonallyNormal && !isEstablishing && ndvi < 0.35;
        const isAlert = !isSeasonallyNormal && !isEstablishing && ndvi < (seasonalRange?.[0] ?? 0.50);

        const bg = isEstablishing
          ? 'bg-gray-50 border-gray-200'
          : isCritical ? 'bg-red-50 border-red-200'
          : isAlert ? 'bg-orange-50 border-orange-200'
          : 'bg-green-50 border-green-200';
        const textColor = isEstablishing
          ? 'text-gray-700'
          : isCritical ? 'text-red-800'
          : isAlert ? 'text-orange-800'
          : 'text-green-800';

        const title = isEstablishing
          ? (parcel.establishmentPhase
              ? `Cultivo en establecimiento — valor esperable para ${cropLabel(cropType)}`
              : `Cobertura vegetal baja — contexto fisiológico`)
          : isCritical
          ? 'Estres vegetativo severo — atencion urgente'
          : isAlert
          ? 'Actividad vegetal por debajo del rango estacional'
          : 'Cultivo dentro del rango estacional normal';

        const body = isEstablishing
          ? `NDVI ${ndvi.toFixed(3)}. Los valores bajos son esperables hasta que el ${cropLabel(cropType)} complete cobertura. Sin acción requerida.`
          : isCritical
          ? `NDVI ${ndvi.toFixed(3)}${isDecline ? `, bajando ${Math.abs(trend).toFixed(3)} puntos` : ''}. Perdida severa de actividad vegetal.`
          : isAlert
          ? `NDVI ${ndvi.toFixed(3)}${isDecline ? ', con tendencia descendente' : ''}. Por debajo del minimo esperado para este cultivo en este periodo.`
          : `NDVI ${ndvi.toFixed(3)}. Actividad vegetal normal para la epoca${isDecline ? ', aunque con ligera tendencia a la baja' : ''}.`;

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
              spatialNote = `Gradiente espacial claro: zona ${weakZone} en NDVI ${Math.min(northMean,southMean).toFixed(2)} frente a zona ${strongZone} en ${Math.max(northMean,southMean).toFixed(2)}. Posible diferencia de suelo, humedad o exposicion.`;
            } else {
              const stressPct = Math.round((pts.filter((p) => p.ndvi < 0.35).length / pts.length) * 100);
              if (isEstablishing) {
                // En establecimiento o NDVI bajo fisiológico, NO imputar
                // "sequía / enfermedad / carencia". Es esperable que mucho
                // píxel esté <0.35 — eso es suelo desnudo, no estrés vegetal.
                spatialNote = `Cobertura uniformemente baja (${stressPct}% de píxeles bajo 0.35). Patrón esperable mientras el ${cropLabel(cropType)} completa su cobertura — sin diagnóstico de estrés.`;
              } else if (stressPct > 50) spatialNote = `Estres distribuido de forma uniforme (${stressPct}% de pixeles con NDVI < 0.35). Sugiere causa generalizada: sequia, enfermedad o carencia nutricional.`;
              else if (stressPct > 15) spatialNote = `Focos de estres localizados en ${stressPct}% de la parcela. El resto mantiene actividad normal.`;
              else spatialNote = `Actividad vegetal uniforme en toda la parcela. Sin patrones espaciales de estres.`;
            }
          }
        } else if (ndviRange > 0.30) {
          // Fallback: use min/max from NDVI reading itself
          spatialNote = `Rango NDVI amplio dentro de la parcela: min ${ndviMin.toFixed(2)} — max ${ndviMax.toFixed(2)} (diferencia de ${ndviRange.toFixed(2)}). Heterogeneidad significativa: hay zonas muy sanas junto a zonas en estres.`;
        }

        const seasonalNote = buildSeasonalNote(ndvi, cropType, month);
        const causeNote = (isCritical || isAlert) ? buildCauseNote(ndvi, cropType, month, ndviRange) : '';

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
                  <p className="text-xs text-gray-400">Rango parcela</p>
                  <p className="text-sm font-bold text-gray-700">{ndviMin.toFixed(2)} – {ndviMax.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{ndviRange > 0.40 ? 'Alta heterogeneidad' : ndviRange > 0.20 ? 'Heterogeneidad moderada' : 'Uniforme'}</p>
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

            {/* Card 2: Interpretation + seasonal context + causes */}
            <div className={`rounded-xl border p-5 flex flex-col justify-between ${bg}`}>
              <div className="space-y-2">
                <p className={`text-sm font-semibold ${textColor}`}>{title}</p>
                <p className={`text-xs leading-relaxed ${textColor} opacity-90`}>{body}</p>
                {seasonalNote && (
                  <p className={`text-xs leading-relaxed ${textColor} opacity-80 border-t border-current border-opacity-20 pt-2`}>
                    {seasonalNote}
                  </p>
                )}
                {spatialNote && (
                  <p className={`text-xs leading-relaxed ${textColor} opacity-75 border-t border-current border-opacity-20 pt-2`}>
                    {spatialNote}
                  </p>
                )}
                {causeNote && (
                  <p className={`text-xs leading-relaxed ${textColor} opacity-75 border-t border-current border-opacity-20 pt-2`}>
                    {causeNote}
                  </p>
                )}
              </div>
              {(isCritical || isAlert) && activeAlerts.length > 0 && (
                <button
                  onClick={() => { setServiceModal({ alert: activeAlerts[0] }); setServiceStep(1); setServiceType('inspection'); setServiceNotes(''); }}
                  className="mt-4 bg-brand-600 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-brand-700 transition-colors font-medium w-full"
                >
                  Solicitar servicio de dron
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Sentinel-2 indices — current snapshot */}
      {parcel.ndviHistory?.length > 0 && (() => {
        const latest = parcel.ndviHistory[parcel.ndviHistory.length - 1];
        const prev = parcel.ndviHistory[parcel.ndviHistory.length - 2];
        const indices: { label: string; value: number | undefined; prev: number | undefined; tooltip: string; color: string }[] = [
          { label: 'NDVI', value: latest.mean, prev: prev?.mean,
            tooltip: 'Vigor general del cultivo. <0.30 critico · 0.30-0.40 alerta · 0.40-0.55 medio · >0.55 sano.',
            color: '#16a34a' },
          { label: 'NDRE', value: latest.ndreValue, prev: prev?.ndreValue,
            tooltip: 'Clorofila Red Edge (B05). Mas sensible al estres de clorofila que el NDVI; lo detecta antes.',
            color: '#9333ea' },
          { label: 'NDMI', value: latest.ndmiValue, prev: prev?.ndmiValue,
            tooltip: 'Humedad foliar (B11 SWIR). Cae antes que el NDVI bajo estres hidrico.',
            color: '#0ea5e9' },
          { label: 'EVI',  value: latest.eviValue,  prev: prev?.eviValue,
            tooltip: 'Vegetacion mejorada. Corrige suelo y atmosfera; mejor que NDVI con copa rala.',
            color: '#65a30d' },
          { label: 'SAVI', value: latest.saviValue, prev: prev?.saviValue,
            tooltip: 'Vegetacion ajustada al suelo. Util en pistacho y otros cultivos con marco abierto.',
            color: '#84cc16' },
        ];
        const available = indices.filter((i) => i.value !== undefined && i.value !== null);
        if (available.length <= 1) return null; // only NDVI → don't show panel yet
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Indices Sentinel-2</h2>
              <span className="text-xs text-gray-400">Ultima escena · {formatDate(latest.date)}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {available.map((idx) => {
                const v = idx.value as number;
                const trend = idx.prev !== undefined ? v - idx.prev : null;
                return (
                  <div key={idx.label} className="bg-gray-50 rounded-lg p-3 border border-gray-100" title={idx.tooltip}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: idx.color }}>{idx.label}</p>
                    <p className="text-2xl font-bold tabular-nums text-gray-900 mt-1">{v.toFixed(3)}</p>
                    {trend !== null && Math.abs(trend) >= 0.005 && (
                      <p className={`text-[10px] font-semibold mt-0.5 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {trend > 0 ? '+' : ''}{trend.toFixed(3)} vs ant.
                      </p>
                    )}
                  </div>
                );
              })}
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

      {/* Ola 1.5 · Pieza 1 — NDVI trend forecast (the morning-digest preview) */}
      <div className="mb-4">
        <NdviForecastCard parcelId={parcel._id} />
      </div>

      {/* Ola 1.5 · Pieza 2 — Personalised weather events from Open-Meteo */}
      <div className="mb-4">
        <WeatherEventsCard parcelId={parcel._id} />
      </div>

      {/* Ola 1.5 · Pieza 3 — Curated pest advisories matching parcel comarca */}
      <div className="mb-4">
        <PestAdvisoriesCard parcelId={parcel._id} />
      </div>

      {/* MPC long-term context — Sprint MPC */}
      <div className="mb-4">
        <MpcContextWidget
          currentNdvi={
            parcel.ndviHistory?.length
              ? parcel.ndviHistory[parcel.ndviHistory.length - 1].mean
              : null
          }
          currentMonth={new Date().getMonth() + 1}
          modisBaseline={parcel.modisBaseline}
          climateBaseline={parcel.climateBaseline}
          recentClimate={parcel.recentClimate}
          thermal={parcel.thermal}
          establishmentPhase={parcel.establishmentPhase}
          cropType={parcel.cropType}
        />
      </div>

      {/* Forecast — closes the loop "we saw X happen → here's when you can act" */}
      <div className="mb-4">
        {(() => {
          const [lon, lat] = polygonCentroid(parcel.geometry);
          return <WeatherWidget lat={lat} lon={lon} parcelName={parcel.name} />;
        })()}
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
                        onClick={() => { setServiceModal({ alert }); setServiceStep(1); setServiceType('inspection'); setServiceNotes(''); }}
                        className="bg-terra-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-terra-600 transition-colors font-medium whitespace-nowrap"
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
                        className="bg-blue-50 border border-blue-200 text-blue-600 text-xs px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 whitespace-nowrap"
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

      {/* ── Service Request Modal ───────────────────────────────────────────── */}
      {serviceModal && parcel && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Solicitar servicio de dron</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{parcel.name} · {parcel.areaHa} ha · {parcel.province}</p>
                </div>
                <button onClick={() => setServiceModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-4">✕</button>
              </div>
            </div>

            {serviceStep === 1 ? (
              /* Step 1: Choose service type */
              <div className="p-6 space-y-3">
                <p className="text-sm text-gray-600 mb-4">La IA ha detectado una anomalia en esta parcela. ¿Que necesitas ahora?</p>

                <button
                  onClick={() => setServiceType('inspection')}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${serviceType === 'inspection' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🔍</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Inspeccion multiespectral</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Dron con camara NDVI de alta resolucion. Mapea la parcela al centimetro y localiza el foco exacto del problema.</p>
                      <p className="text-xs text-brand-600 mt-1.5 font-medium">Recomendado como primer paso · antes de tratar</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setServiceType('phytosanitary')}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${serviceType === 'phytosanitary' ? 'border-terra-500 bg-terra-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💊</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Tratamiento fitosanitario</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Dron aplicador con producto fitosanitario. Tratamiento de precision zona a zona segun el mapa de estres.</p>
                      <p className="text-xs text-terra-600 mt-1.5 font-medium">Cuando ya tienes diagnostico y quieres actuar</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setServiceStep(2)}
                  className="w-full mt-2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors font-medium"
                >
                  Continuar →
                </button>
              </div>
            ) : (
              /* Step 2: Confirm */
              <div className="p-6">
                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{serviceType === 'inspection' ? '🔍' : '💊'}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {serviceType === 'inspection' ? 'Inspeccion multiespectral' : 'Tratamiento fitosanitario'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1 pl-7">
                    <p>Parcela: <span className="font-medium text-gray-700">{parcel.name} · {parcel.areaHa} ha</span></p>
                    <p>Alerta: <span className="font-medium text-gray-700">
                      NDVI {serviceModal.alert.ndviValue.toFixed(2)} · {serviceModal.alert.severity === 'critical' ? 'Critica' : serviceModal.alert.severity === 'high' ? 'Alta' : 'Media'}
                    </span></p>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-700 block mb-1.5">
                    Informacion adicional para el piloto <span className="text-gray-400">(opcional)</span>
                  </label>
                  <textarea
                    value={serviceNotes}
                    onChange={(e) => setServiceNotes(e.target.value)}
                    placeholder={serviceType === 'inspection'
                      ? 'Ej: zona norte parece mas afectada, hay un camino de acceso por el este...'
                      : 'Ej: posible verticillium, ya aplique cobre en febrero, acceso por puerta principal...'}
                    rows={3}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-brand-400 placeholder-gray-300"
                  />
                </div>

                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                  Un piloto certificado de tu zona contactara contigo en menos de 24h para coordinar fecha y condiciones.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setServiceStep(1)}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    ← Volver
                  </button>
                  <button
                    onClick={() => requestServiceMutation.mutate({ alert: serviceModal.alert, type: serviceType, notes: serviceNotes })}
                    disabled={requestServiceMutation.isPending}
                    className={`flex-1 text-white text-sm px-4 py-2.5 rounded-xl transition-colors font-medium disabled:opacity-50 ${serviceType === 'inspection' ? 'bg-brand-600 hover:bg-brand-700' : 'bg-terra-500 hover:bg-terra-600'}`}
                  >
                    {requestServiceMutation.isPending ? 'Enviando...' : 'Confirmar solicitud'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
