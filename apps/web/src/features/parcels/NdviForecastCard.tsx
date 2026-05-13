import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { inferCoverLevel } from '@fitolink/shared';

/**
 * Ola 1.5 · Pieza 1 — NDVI trend forecast card.
 *
 * Surfaces the parcel's own trajectory with the Spanish-language message
 * that will later anchor the morning digest (Versión D copy). Designed
 * to drop above the MpcContextWidget in ParcelDetailPage — same width
 * and visual language (AgroM tokens, mono eyebrows, hairline rules).
 *
 * The component shows nothing for parcels still gathering history (n<3);
 * the morning digest will simply skip them.
 */

type Trend = 'descending' | 'ascending' | 'stable';
type Confidence = 'high' | 'medium' | 'low' | 'none';

interface NdviForecast {
  parcelId: string;
  parcelName: string;
  cropType: string;
  currentNdvi: number | null;
  currentNdviDate: string | null;
  trend: Trend;
  slopePerDay: number;
  recentDelta: number;
  windowDays: number;
  criticalThreshold: number;
  daysToCritical: number | null;
  projectedCriticalDate: string | null;
  alreadyCritical: boolean;
  confidence: Confidence;
  readingsUsed: number;
  message: string | null;
  establishmentPhase: boolean;
}

interface Props {
  parcelId: string;
}

const TREND_LABEL: Record<Trend, string> = {
  descending: 'En descenso',
  ascending:  'En mejora',
  stable:     'Estable',
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high:   'alta',
  medium: 'media',
  low:    'baja',
  none:   '—',
};

export default function NdviForecastCard({ parcelId }: Props) {
  const { data, isLoading } = useQuery<NdviForecast>({
    queryKey: ['ndvi-forecast', parcelId],
    queryFn: async () => {
      const res = await api.get(`/parcels/${parcelId}/insights/ndvi-forecast`);
      return res.data.data;
    },
    refetchInterval: 30 * 60 * 1000,  // server data refreshes every pipeline cycle
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-xl border border-agrom-rule/30 overflow-hidden">
        <div className="bg-agrom-deep px-4 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-agrom-paper/70">
            § PROYECCIÓN — ANÁLISIS PREDICTIVO
          </p>
        </div>
        <div className="p-6 text-center text-sm text-agrom-muted">Cargando proyección…</div>
      </div>
    );
  }

  // State tone — drives the accent color of the trend pill
  const toneClass = data.alreadyCritical
    ? 'bg-agrom-alert/10 text-agrom-alert'
    : data.trend === 'descending'
      ? 'bg-agrom-warning/15 text-agrom-warning'
      : data.trend === 'ascending'
        ? 'bg-agrom-success/15 text-agrom-success'
        : 'bg-agrom-info/15 text-agrom-info';

  const dotClass = data.alreadyCritical
    ? 'bg-agrom-alert'
    : data.trend === 'descending'
      ? 'bg-agrom-warning'
      : data.trend === 'ascending'
        ? 'bg-agrom-success'
        : 'bg-agrom-info';

  return (
    <div className="bg-white rounded-xl border border-agrom-rule/30 overflow-hidden">
      {/* Brand strip header */}
      <div className="bg-agrom-deep px-4 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-agrom-paper/70">
          § PROYECCIÓN — ANÁLISIS PREDICTIVO
        </p>
      </div>

      {/* Headline message (the Tipo A friendly line) */}
      <div className="px-5 pt-5 pb-3">
        <p className="font-display text-lg text-agrom-ink leading-snug">
          {data.message}
        </p>
      </div>

      {/* Quantitative strip — discreet, mono, never the protagonist */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-agrom-rule/30 border-t border-agrom-rule/30">
        {/* Trend */}
        <div className="bg-white px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-agrom-muted mb-1">
            Tendencia
          </p>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`} />
            <span className="text-sm font-semibold text-agrom-ink">{TREND_LABEL[data.trend]}</span>
          </div>
        </div>
        {/* Current NDVI vs threshold */}
        <div className="bg-white px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-agrom-muted mb-1">
            Estado actual
          </p>
          <p className="text-sm font-semibold tabular-nums text-agrom-ink">
            {data.currentNdvi !== null ? data.currentNdvi.toFixed(2) : '—'}
            <span className="text-agrom-muted font-normal"> / {data.criticalThreshold.toFixed(2)}</span>
          </p>
        </div>
        {/* Projected date */}
        <div className={`bg-white px-4 py-3 ${data.projectedCriticalDate ? '' : 'opacity-60'}`}>
          <p className="font-mono text-[9px] uppercase tracking-wider text-agrom-muted mb-1">
            Proyección
          </p>
          {data.projectedCriticalDate ? (
            <p className="text-sm font-semibold text-agrom-ink">
              {formatProjectedDate(data.projectedCriticalDate)}
              <span className="block font-mono text-[10px] text-agrom-muted font-normal mt-0.5">
                en {data.daysToCritical} días
              </span>
            </p>
          ) : (
            <p className="text-sm text-agrom-muted">—</p>
          )}
        </div>
        {/* Confidence */}
        <div className="bg-white px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-agrom-muted mb-1">
            Confianza
          </p>
          <p className="text-sm font-semibold text-agrom-ink">
            {CONFIDENCE_LABEL[data.confidence]}
            <span className="block font-mono text-[10px] text-agrom-muted font-normal mt-0.5">
              {data.readingsUsed} lectura{data.readingsUsed === 1 ? '' : 's'}
            </span>
          </p>
        </div>
      </div>

      {/* Pill summary — contextualizada por nivel de cobertura del cultivo.
          En parcelas en establecimiento (o NDVI fisiológicamente bajo) el
          alreadyCritical es esperable, no acción real. Cambiamos el mensaje
          de "acción recomendada" a "esperable en establecimiento" para no
          inducir intervención innecesaria. */}
      {data.alreadyCritical && (() => {
        const cover = inferCoverLevel({
          ndvi: data.currentNdvi,
          establishmentPhase: data.establishmentPhase,
        });
        if (cover === 'low') {
          return (
            <div className="px-5 py-3 border-t border-agrom-rule/30 bg-agrom-paper">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider bg-gray-100 text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {data.establishmentPhase
                  ? 'En establecimiento · valor esperable'
                  : 'Cobertura baja · contexto fisiológico'}
              </span>
            </div>
          );
        }
        return (
          <div className="px-5 py-3 border-t border-agrom-rule/30 bg-agrom-paper">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider ${toneClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
              Por debajo de umbral · acción recomendada
            </span>
          </div>
        );
      })()}
    </div>
  );
}

/** Formato "23 mayo" — corto, sin año (siempre el actual). */
function formatProjectedDate(iso: string): string {
  const d = new Date(iso);
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}
