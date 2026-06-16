/**
 * PREDICCIÓN — panel de trabajo de la parcela del fondo (Encineño).
 *
 * Es una HERRAMIENTA, no un pitch: dato + estado + etiquetas. Cero narrativa,
 * cero venta, cero explicación de lo obvio. La prueba del modelo (motores,
 * correlaciones) vive en el informe técnico, NO aquí.
 *
 * Regla nº1 (no_inventar): lo que no se ha medido se muestra como "—" con la
 * fuente que lo proporcionaría. Ningún número fabricado.
 */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import NdviChart from '@/features/parcels/NdviChart.js';
import ParcelMap from '@/features/parcels/ParcelMap.js';
import { ndviColor, ndviHealthLabel } from '@/lib/cropHealth.js';
import { seriesSpan, type NdviReading } from './predictionUtils.js';
import { ENCINENO_ZONES, ZONES_META } from './encinenoZonesRef.js';
import ZonesLayer, { ZONE_COLOR } from './ZonesLayer.js';

interface Parcel {
  _id: string;
  name: string;
  cropType: string;
  areaHa: number;
  province: string;
  geometry?: GeoJSON.Polygon;
  ndviHistory: NdviReading[];
}

const fmt = (n: number | undefined, d = 3) => (n == null ? '—' : n.toFixed(d));

/**
 * Regla nº1 (no_inventar): las zonas/serie de esta vista son las de ENCINEÑO
 * (la parcela del fondo, seed `seedEncinenoDemo` · "Finca Encineño · Sector
 * 407 ha"). NUNCA deben pintarse sobre otra finca. Identificamos Encineño por
 * su nombre (contiene "Encineño"/"Encineno") — es el único robusto: el _id es
 * un ObjectId que se genera en cada seed, y otras parcelas de olivo pueden
 * tener su propio ndviHistory del pipeline V2. Si la cuenta no tiene Encineño,
 * NO caemos en "la primera de olivo": mostramos un estado honesto sin números
 * ni zonas ajenas.
 */
const isEncineno = (p: Parcel): boolean =>
  /encine[ñn]o/i.test(p.name ?? '');

export default function PredictionPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['parcels', 'mine'],
    queryFn: async () => {
      const res = await api.get('/parcels/mine');
      return res.data.data as Parcel[];
    },
  });

  const parcels: Parcel[] = data ?? [];
  const parcel = parcels.find(isEncineno);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="h-80 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  // Sin Encineño (o sin su serie) → estado honesto. JAMÁS datos/zonas de otra
  // finca: el modelo de cosecha se calibra por parcela y aún no hay otra.
  if (!parcel || !parcel.ndviHistory?.length) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-10 text-center mt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-2">§ Predicción</p>
        <h1 className="font-display text-2xl text-brand-900 mb-2">Sin datos de predicción para esta cuenta</h1>
        <p className="text-sm text-gray-500">El modelo de cosecha requiere calibración por parcela.</p>
      </div>
    );
  }

  const h = parcel.ndviHistory;
  const span = seriesSpan(h);
  const last = h[h.length - 1];
  const prev = h[h.length - 2];
  const trend = prev ? last.mean - prev.mean : null;
  const anomalies = h.filter((r) => r.anomalyDetected).length;

  return (
    <div className="max-w-6xl mx-auto pb-4">
      {/* Cabecera · identidad de la parcela */}
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500 mb-1">
            § Predicción de cosecha
          </p>
          <h1 className="font-display text-2xl text-brand-900 leading-tight">{parcel.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Olivo (aceituna) · secano · {parcel.province} · variedad: <span className="text-gray-400">—</span>
          </p>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-wider text-terra-600 bg-terra-50 border border-terra-500/30 rounded-full px-2 py-1 flex-shrink-0">
          en desarrollo
        </span>
      </div>

      {/* Resultado · ventana de recogida (el entregable) */}
      <HarvestWindowCard />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <Kpi label="Cultivo" value="Olivo" sub="aceituna · secano" />
        <Kpi label="Superficie" value={Math.floor(parcel.areaHa).toLocaleString('es-ES')} unit="ha" sub={parcel.province} />
        <Kpi
          label="NDVI (vigor)"
          value={fmt(last.mean, 2)}
          color={ndviColor(last.mean, parcel.cropType)}
          sub={`${ndviHealthLabel(last.mean, parcel.cropType)} · ${formatDate(last.date as string)}`}
        />
        <Kpi
          label="Tendencia"
          value={trend == null ? '—' : `${trend > 0 ? '+' : ''}${trend.toFixed(3)}`}
          color={trend == null ? undefined : trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : undefined}
          sub="vs lectura anterior"
        />
        <Kpi label="NDRE (clorofila)" value={fmt(last.ndreValue)} sub="maduración / envero" />
        <Kpi label="NDMI (humedad)" value={fmt(last.ndmiValue)} sub="estrés hídrico foliar" />
      </div>

      {/* Mapa · zonas de manejo */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
            Parcela · zonas de manejo (satélite)
          </p>
          {ZONES_META && (
            <span className="font-mono text-[10px] text-gray-400">mediana de {ZONES_META.scenes} escenas</span>
          )}
        </div>
        <div className="h-[340px]">
          <ParcelMap
            parcels={[parcel] as never}
            height="100%"
            mapStyle="satellite"
            showDetailLink={false}
          >
            {/* Las celdas de zona son las de Encineño: solo se pintan si la
                parcela vinculada ES Encineño (nunca sobre otra finca). */}
            <ZonesLayer isEncineno={isEncineno(parcel)} />
          </ParcelMap>
        </div>
        {ENCINENO_ZONES.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 flex-wrap">
            {[...ENCINENO_ZONES].sort((a, b) => b.meanNdvi - a.meanNdvi).map((z) => (
              <span key={z.id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: ZONE_COLOR[z.id] }} />
                <span className="text-[11px] text-gray-500">{z.label} · {z.areaHa} ha</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex items-center justify-between mb-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">Histórico NDVI · NDRE · NDMI</p>
          <span className="font-mono text-[10px] text-gray-400">
            {span.from && span.to && `${formatDate(span.from.toISOString())} – ${formatDate(span.to.toISOString())}`}
            {anomalies > 0 && ` · ${anomalies} anomalías`}
          </span>
        </div>
        <NdviChart data={h as never} height={260} cropType={parcel.cropType} />
        <p className="font-mono text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">
          Media zonal del polígono real · recorte SIGPAC · escala calibrada a olivar de secano.
        </p>
      </div>

      {/* Predicción + datos del fondo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Rendimiento y calidad (estimación)">
          <Field label="Rendimiento estimado (kg/ha)" value="—" note="requiere histórico de cosecha + censo por dron" />
          <Field label="Índice de madurez en cosecha" value="—" note="requiere muestreo de campo / dron" />
          <Field label="Carga por árbol" value="—" note="requiere censo por dron" />
        </Panel>

        <Panel title="Datos a aportar por el fondo">
          <Field label="Campañas con cosecha registrada" value="—" />
          <Field label="kg por campaña y parcela" value="—" />
          <Field label="Fechas de recogida" value="—" />
          <Field label="Índice de madurez (Jaén 0–7)" value="—" />
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, unit, sub, color }: {
  label: string; value: string | number; unit?: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-earth-300/30 p-3">
      <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1 truncate">{label}</p>
      <p className="font-display text-2xl leading-none tabular-nums" style={color ? { color } : { color: '#18230f' }}>
        {value}{unit && <span className="text-sm text-gray-500"> {unit}</span>}
      </p>
      {sub && <p className="text-[10px] text-gray-400 mt-1.5 leading-snug truncate" title={sub}>{sub}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-3">{title}</p>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function Field({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-gray-700">{label}</p>
        {note && <p className="text-[11px] text-gray-400">{note}</p>}
      </div>
      <p className="font-display text-lg text-gray-400 tabular-nums flex-shrink-0">{value}</p>
    </div>
  );
}

/**
 * El entregable: ventana de recogida. Cuadro grande y prominente. Las fechas van
 * PENDIENTES (no se inventan) — es el marco donde aparece la respuesta cuando se
 * calcule con el histórico del fondo + el dron. El eje de meses es referencia de
 * temporada, NO una predicción de Encineño.
 */
const vigorColor = (label: string) =>
  label.includes('alto') ? '#86efac' : label.includes('medio') ? '#fde047' : '#fb923c';

function HarvestWindowCard() {
  // Temporada de recogida de aceituna de almazara en Andalucía/Córdoba:
  // octubre → febrero (grueso nov-dic-ene). Verificado, no inventado.
  const months = ['oct', 'nov', 'dic', 'ene', 'feb'];
  const zones = [...ENCINENO_ZONES].sort((a, b) => b.meanNdvi - a.meanNdvi);

  return (
    <div className="bg-brand-700 rounded-xl p-5 mb-5 text-white">
      <div className="flex items-center justify-between mb-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-100">
          § Resultado · ventana de recogida por sector
        </p>
        <span className="text-[9px] font-mono uppercase tracking-wider text-brand-100 bg-white/10 border border-white/20 rounded-full px-2 py-0.5">
          pendiente de calibración
        </span>
      </div>
      <p className="text-[12px] text-brand-100/80 mb-4">
        {zones.length > 0
          ? `La finca se divide en ${zones.length} zonas de manejo por vigor (satélite). Cada una madura distinto.`
          : 'Computando los sectores desde el satélite…'}
      </p>

      {zones.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-white/10 mb-4">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-white/5 font-mono text-[9px] uppercase tracking-wider text-brand-100/70">
            <div className="col-span-5">Sector</div>
            <div className="col-span-4 text-right">Superficie</div>
            <div className="col-span-3 text-right">Vigor</div>
          </div>
          {zones.map((z) => (
            <div key={z.id} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-t border-white/10 items-center">
              <div className="col-span-5 flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: vigorColor(z.label) }} />
                <span className="text-sm truncate">{z.label}</span>
              </div>
              <div className="col-span-4 text-right leading-none">
                <span className="font-display text-lg">{z.areaHa}</span>
                <span className="text-[11px] text-brand-100/60"> ha · {z.areaPct}%</span>
              </div>
              <div className="col-span-3 text-right text-sm tabular-nums text-brand-100/90">{z.meanNdvi.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Calendario de recogida · por sector — la ventana de cada zona aparece
          aquí al calibrar. Hoy pendiente (pista vacía), sin fechas inventadas. */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-x-2">
          <p className="font-mono text-[9px] uppercase tracking-wider text-brand-100/60">
            Calendario de recogida
          </p>
          <p className="text-[10px] text-brand-100/45">
            la ventana de cada sector se marca aquí al calibrar
          </p>
        </div>
        {/* eje de meses (alineado con las pistas) */}
        <div className="grid grid-cols-5 mb-1.5 pl-[92px]">
          {months.map((m) => (
            <span key={m} className="font-mono text-[9px] uppercase tracking-wider text-brand-100/50 text-center">{m}</span>
          ))}
        </div>
        {/* una pista por sector — vacía y punteada hasta que el modelo la calcule */}
        <div className="space-y-1.5">
          {zones.map((z) => (
            <div key={z.id} className="flex items-center gap-3">
              <div className="w-20 flex items-center gap-1.5 flex-shrink-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: vigorColor(z.label) }} />
                <span className="text-[11px] text-brand-100/75 truncate">{z.label}</span>
              </div>
              <div className="flex-1 h-4 rounded border border-dashed border-white/25 flex items-center justify-center">
                <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-brand-100/35">pendiente</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 pt-3 space-y-1">
        <p className="text-[12px] text-brand-100/90">
          No se recoge de una vez: el óptimo de cada sector se calcula con el histórico de cosecha del fondo + el vuelo con dron.
        </p>
        {ZONES_META && (
          <p className="font-mono text-[10px] text-brand-100/50">
            {zones.length} zonas · mediana de {ZONES_META.scenes} escenas Sentinel-2 ({ZONES_META.dateRange})
          </p>
        )}
      </div>
    </div>
  );
}
