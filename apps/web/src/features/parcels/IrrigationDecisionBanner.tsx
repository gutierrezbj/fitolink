import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';

/**
 * IrrigationDecisionBanner · BUMM Regantes · 05-jun-2026.
 *
 * Banner editorial que convierte 7 cards técnicas (NDVI + suelo + clima
 * + cultivo) en UNA decisión clara de riego para gerente de Comunidad
 * de Regantes / ADV / Cooperativa.
 *
 * Renderiza condicional al endpoint /parcels/:id/insights/irrigation-decision.
 *
 * Visible solo si el ParcelDetailPage decide montarlo (pasa el rol del
 * usuario · este componente NO comprueba rol, es responsabilidad del
 * padre porque la lógica de "cuándo mostrar" puede cambiar por feature
 * flag · A/B test · etc).
 */

type Urgency = 'urgent' | 'soon' | 'monitor' | 'sufficient';

interface IrrigationDecision {
  urgency: Urgency;
  recommendedAction: string;
  reason: string;
  ndviCurrent: number | null;
  ndviTrend7d: number | null;
  estimatedDeficitMm: number;
  estimatedCupoM3: number;
  cupoWithRd9502024M3: number;
  precipRecentMm: number;
  awcMm: number;
  etCropMmDay: number;
  alternative: string | null;
  analysisNarrative: string;
  computedAt: string;
}

const URGENCY_STYLES: Record<Urgency, { wrapper: string; eyebrow: string; pulseDot: boolean }> = {
  urgent: {
    wrapper: 'bg-red-50 border-red-300',
    eyebrow: 'text-red-700',
    pulseDot: true,
  },
  soon: {
    wrapper: 'bg-terra-500/10 border-terra-500/40',
    eyebrow: 'text-terra-700',
    pulseDot: false,
  },
  monitor: {
    wrapper: 'bg-yellow-50 border-yellow-300',
    eyebrow: 'text-yellow-800',
    pulseDot: false,
  },
  sufficient: {
    wrapper: 'bg-green-50 border-green-300',
    eyebrow: 'text-green-800',
    pulseDot: false,
  },
};

const URGENCY_ICON: Record<Urgency, string> = {
  urgent: '🔴',
  soon: '🟠',
  monitor: '🟡',
  sufficient: '🟢',
};

interface Props {
  parcelId: string;
  ownerName?: string; // socio dueño de la parcela (mostrado en header)
}

export default function IrrigationDecisionBanner({ parcelId, ownerName }: Props) {
  const { data, isLoading, error } = useQuery<IrrigationDecision>({
    queryKey: ['irrigation-decision', parcelId],
    queryFn: async () => {
      const res = await api.get(`/parcels/${parcelId}/insights/irrigation-decision`);
      return res.data.data;
    },
    refetchInterval: 5 * 60 * 1000, // cada 5min suficiente
  });

  if (isLoading) {
    return (
      <div className="bg-white border border-earth-300/30 rounded-xl p-5 animate-pulse">
        <div className="h-3 w-32 bg-gray-200 rounded mb-3" />
        <div className="h-6 w-2/3 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-1/2 bg-gray-100 rounded" />
      </div>
    );
  }

  if (error || !data) {
    // Decisión de riego = decisión crítica de reparto de agua para
    // regantes/cooperativa/ADV. Si el cálculo falla, el silencio es
    // peligroso: el gerente asume "no aplica riego" cuando en realidad
    // NO se pudo calcular. Mostramos una tarjeta de error VISIBLE que
    // deja claro que falló el cálculo — sin sugerir ninguna conclusión
    // de riego (no inventar). Patrón de error tomado de WeatherWidget.
    return (
      <div className="bg-white border-2 border-red-200 rounded-xl p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-700">
          § DECISIÓN DE RIEGO {ownerName ? `· ${ownerName.toUpperCase()}` : ''}
        </p>
        <h2 className="font-display text-base text-brand-900 leading-tight mt-1.5">
          No se pudo calcular la decisión de riego de esta parcela.
        </h2>
        <p className="text-sm text-brand-900 leading-relaxed mt-2">
          El cálculo de cupo y déficit hídrico no está disponible ahora mismo.
          Esto <span className="font-semibold">no significa que no se requiera riego</span> —
          vuelva a intentarlo en unos minutos o revise la parcela manualmente.
        </p>
        {error instanceof Error && error.message && (
          <p className="text-[10px] text-gray-400 mt-3 leading-snug">{error.message}</p>
        )}
      </div>
    );
  }

  const style = URGENCY_STYLES[data.urgency];
  const trendArrow =
    data.ndviTrend7d === null
      ? ''
      : data.ndviTrend7d < -0.02
      ? ' ↓'
      : data.ndviTrend7d > 0.02
      ? ' ↑'
      : ' =';

  return (
    <div className={`border-2 rounded-xl p-5 ${style.wrapper}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className={`font-mono text-[10px] uppercase tracking-[0.22em] ${style.eyebrow}`}>
            § DECISIÓN DE RIEGO {ownerName ? `· ${ownerName.toUpperCase()}` : ''}
          </p>
          <h2 className="font-display text-xl text-brand-900 leading-tight mt-1.5 flex items-center gap-2">
            <span className="text-2xl leading-none">{URGENCY_ICON[data.urgency]}</span>
            {data.recommendedAction}
          </h2>
        </div>
        {style.pulseDot && (
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0 mt-1.5" />
        )}
      </div>

      {/* Justificación agronómica corta · titular */}
      <p className="text-sm text-brand-900 leading-relaxed mb-3">{data.reason}</p>

      {/* Análisis integrado · narrativa server-side cruzando 6-8 variables.
          NO usa LLM · plantillas con datos reales (NDVI + tendencia + cultivo
          + suelo + lluvia + fenología + establecimiento). Cero alucinación. */}
      {data.analysisNarrative && (
        <div className="bg-white/40 border-l-2 border-brand-600 px-3 py-2.5 rounded-r mb-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-brand-600 mb-1.5">
            § ANÁLISIS INTEGRADO
          </p>
          <p className="text-sm text-brand-900 leading-relaxed">{data.analysisNarrative}</p>
        </div>
      )}

      {/* Grid de variables clave · 4 columnas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white/60 rounded-lg p-3 border border-white/40">
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">NDVI actual</p>
          <p className="font-display text-xl text-brand-900 leading-none tabular-nums">
            {data.ndviCurrent !== null ? data.ndviCurrent.toFixed(2) : '—'}
            {trendArrow && (
              <span className="text-sm text-gray-500 ml-1.5">{trendArrow}</span>
            )}
          </p>
          <p className="text-[10px] text-gray-400 mt-1.5">
            {data.ndviTrend7d !== null
              ? `Δ ${data.ndviTrend7d > 0 ? '+' : ''}${data.ndviTrend7d.toFixed(2)} vs lectura anterior`
              : 'sin tendencia'}
          </p>
        </div>
        <div className="bg-white/60 rounded-lg p-3 border border-white/40">
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">
            Déficit hídrico
          </p>
          <p className="font-display text-xl text-brand-900 leading-none tabular-nums">
            {data.estimatedDeficitMm}
            <span className="text-sm text-gray-500 ml-0.5">mm</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-1.5">acumulado 14 días</p>
        </div>
        <div className="bg-white/60 rounded-lg p-3 border border-white/40">
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">
            ET cultivo
          </p>
          <p className="font-display text-xl text-brand-900 leading-none tabular-nums">
            {data.etCropMmDay}
            <span className="text-sm text-gray-500 ml-0.5">mm/d</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-1.5">demanda diaria</p>
        </div>
        <div className="bg-white/60 rounded-lg p-3 border border-white/40">
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">
            Reserva suelo
          </p>
          <p className="font-display text-xl text-brand-900 leading-none tabular-nums">
            {data.awcMm}
            <span className="text-sm text-gray-500 ml-0.5">mm</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-1.5">cap. campo · 30 cm</p>
        </div>
      </div>

      {/* Cupo m³ · LO QUE EL GERENTE NECESITA · solo si hay déficit real.
          Cuando cupo=0 (sufficient), reemplazamos por mensaje editorial
          corto sin el bloque pesado — no tiene sentido destacar "0 m³". */}
      {data.estimatedCupoM3 > 0 ? (
        <div className="bg-earth-100 border-2 border-brand-600/30 rounded-lg p-4 mb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand-600 mb-1.5">
                → CUPO ESTIMADO PARA ESTA PARCELA
              </p>
              <p className="font-display text-3xl leading-none text-brand-900">
                {data.estimatedCupoM3.toLocaleString('es-ES')}
                <span className="text-base text-gray-500 ml-1.5">m³</span>
              </p>
              <p className="text-[10px] text-gray-500 mt-1.5">
                {data.estimatedDeficitMm} mm × superficie real catastral × 10
              </p>
            </div>
            <div className="border-l border-brand-600/20 pl-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-terra-500 mb-1.5">
                CON RD 950/2024 · −20%
              </p>
              <p className="font-display text-3xl leading-none text-terra-500">
                {data.cupoWithRd9502024M3.toLocaleString('es-ES')}
                <span className="text-base text-gray-500 ml-1.5">m³</span>
              </p>
              <p className="text-[10px] text-gray-500 mt-1.5">cupo efectivo aplicable</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/50 border border-brand-600/20 rounded-lg p-3 mb-3 text-center">
          <p className="text-sm text-brand-900 leading-relaxed">
            Sin déficit hídrico significativo · <span className="font-semibold">no se requiere riego esta semana</span>
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            Suelo + lluvia reciente cubren la demanda del cultivo
          </p>
        </div>
      )}

      {/* Alternativa · si aplica */}
      {data.alternative && (
        <div className="bg-white/50 border-l-2 border-brand-600 px-3 py-2 rounded-r-md">
          <p className="font-mono text-[9px] uppercase tracking-wider text-brand-600 mb-0.5">
            § ALTERNATIVA
          </p>
          <p className="text-xs text-brand-900 leading-relaxed">{data.alternative}</p>
        </div>
      )}

      {/* Pie editorial · trazabilidad */}
      <p className="text-[10px] text-gray-400 mt-3 leading-snug">
        Cálculo basado en FAO-56 simplificado · NDVI Sentinel-2 + textura SoilGrids + ERA5 reciente + Kc cultivo {data.ndviCurrent !== null ? '· última lectura ' + new Date(data.computedAt).toLocaleDateString('es-ES') : ''}
      </p>
    </div>
  );
}
