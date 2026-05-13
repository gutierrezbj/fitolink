/**
 * Microsoft Planetary Computer context widget — Sprint MPC.
 *
 * Surfaces the long-term context that distinguishes FitoLink from a
 * "this week's NDVI" service: 5-year MODIS baseline + climate normals +
 * 30-day actual weather anomaly. All free, all global.
 *
 * El badge térmico se matiza con `inferCoverLevel` para no etiquetar
 * "Estrés crítico" a parcelas con suelo dominantemente expuesto
 * (establecimiento, NDVI bajo): allí un delta LST-aire alto es física
 * del suelo desnudo al sol, no estrés del cultivo.
 */
import { inferCoverLevel, cropLabel } from '@fitolink/shared';

type ModisMonth = { month: number; mean: number; std: number; n: number };
type ClimateMonth = {
  month: number;
  precip: number;
  tmax: number;
  tmin: number;
  pdsi?: number;
  pet?: number;
};

interface Props {
  currentNdvi: number | null;
  currentMonth: number; // 1-12
  modisBaseline?: {
    source: string;
    years: number;
    months: ModisMonth[];
    allTimeMean: number;
    observationCount: number;
  };
  climateBaseline?: {
    source: string;
    period: string;
    months: ClimateMonth[];
    annualPrecip: number;
    aridityIndex?: number;
  };
  recentClimate?: {
    days: number;
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
  thermal?: {
    source: string;
    days: number;
    lstC: number;
    airTempC?: number | null;
    lstDeltaAirC?: number | null;
    scenesUsed: number;
    lastDate?: string | null;
  };
  /**
   * Crop context — usado para matizar interpretaciones que serían falsos
   * positivos en parcelas sin cobertura vegetal completa. Sin estos el
   * widget cae al threshold absoluto (LST-aire ≥ 8°C = "Estrés crítico"),
   * que en pistachar joven o cultivo recién plantado es engañoso.
   */
  establishmentPhase?: boolean;
  cropType?: string;
}

const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const DROUGHT_STYLE: Record<string, { label: string; bg: string; text: string; border: string }> = {
  none:     { label: 'Normal',         bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200' },
  mild:     { label: 'Sequía leve',    bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200' },
  moderate: { label: 'Sequía moderada',bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  severe:   { label: 'Sequía severa',  bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
};

export default function MpcContextWidget({
  currentNdvi,
  currentMonth,
  modisBaseline,
  climateBaseline,
  recentClimate,
  thermal,
  establishmentPhase,
  cropType,
}: Props) {
  const hasAny = modisBaseline || climateBaseline || recentClimate || thermal;
  if (!hasAny) return null;

  const baselineMonth = modisBaseline?.months.find(m => m.month === currentMonth);
  const climateMonth = climateBaseline?.months.find(m => m.month === currentMonth);

  const ndviDeviation = (currentNdvi !== null && baselineMonth)
    ? currentNdvi - baselineMonth.mean
    : null;
  const ndviDeviationPct = (ndviDeviation !== null && baselineMonth?.mean)
    ? Math.round((ndviDeviation / baselineMonth.mean) * 100)
    : null;

  const drought = recentClimate?.droughtFlag ? DROUGHT_STYLE[recentClimate.droughtFlag] : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header strip — Microsoft branding */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-white" viewBox="0 0 23 23" fill="currentColor">
            <rect x="1" y="1" width="10" height="10" />
            <rect x="12" y="1" width="10" height="10" opacity="0.85" />
            <rect x="1" y="12" width="10" height="10" opacity="0.85" />
            <rect x="12" y="12" width="10" height="10" opacity="0.7" />
          </svg>
          <p className="text-xs font-bold text-white tracking-wide">CONTEXTO HISTÓRICO · MS PLANETARY COMPUTER</p>
        </div>
        <span className="text-[10px] text-white/80 font-medium">Gratis · Global</span>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Block 1 — MODIS NDVI baseline */}
        {modisBaseline && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">NDVI {modisBaseline.years}a</span>
              <span className="text-[9px] text-gray-400">MODIS 250m</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-900">{modisBaseline.allTimeMean.toFixed(2)}</p>
              <p className="text-xs text-gray-400">media histórica</p>
            </div>
            {baselineMonth && (
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[10px] text-gray-500">{MONTH_NAMES[currentMonth - 1]} histórico ({baselineMonth.n} años)</p>
                <p className="text-sm font-semibold text-gray-700">
                  {baselineMonth.mean.toFixed(2)} <span className="text-[10px] text-gray-400 font-normal">±{baselineMonth.std.toFixed(2)}</span>
                </p>
                {ndviDeviation !== null && Math.abs(ndviDeviation) > 0.02 && (
                  <p className={`text-[10px] mt-0.5 font-bold ${ndviDeviation < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {ndviDeviation > 0 ? '+' : ''}{ndviDeviationPct}% vs normal
                  </p>
                )}
              </div>
            )}
            <p className="text-[9px] text-gray-400">{modisBaseline.observationCount} observaciones · MOD13Q1</p>
          </div>
        )}

        {/* Block 2 — TerraClimate baseline */}
        {climateBaseline && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Clima normal</span>
              <span className="text-[9px] text-gray-400">{climateBaseline.period}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-900">{climateBaseline.annualPrecip.toFixed(0)}</p>
              <p className="text-xs text-gray-400">mm/año</p>
            </div>
            {climateMonth && (
              <div className="bg-gray-50 rounded-lg p-2 space-y-0.5">
                <p className="text-[10px] text-gray-500">{MONTH_NAMES[currentMonth - 1]} normal</p>
                <p className="text-sm font-semibold text-gray-700">
                  💧 {climateMonth.precip.toFixed(0)} mm · 🌡 {climateMonth.tmin.toFixed(0)}–{climateMonth.tmax.toFixed(0)}°C
                </p>
                {climateBaseline.aridityIndex !== undefined && climateBaseline.aridityIndex !== null && (
                  <p className="text-[10px] text-gray-500">Índice aridez {climateBaseline.aridityIndex.toFixed(2)}</p>
                )}
              </div>
            )}
            <p className="text-[9px] text-gray-400">TerraClimate · 4km</p>
          </div>
        )}

        {/* Block 3 — Recent climate (actual weather, last 30 days) */}
        {recentClimate && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Últimos {recentClimate.days}d</span>
              <span className="text-[9px] text-gray-400">ERA5</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-900">{recentClimate.precipTotalMm.toFixed(0)}</p>
              <p className="text-xs text-gray-400">mm acumulados</p>
            </div>
            <div className="space-y-1">
              {drought && (
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${drought.bg} ${drought.border}`}>
                  <span className={`text-[10px] font-bold ${drought.text}`}>{drought.label}</span>
                  {recentClimate.precipPctOfNormal !== undefined && recentClimate.precipPctOfNormal !== null && (
                    <span className={`text-[10px] font-bold ${drought.text}`}>
                      {recentClimate.precipPctOfNormal}% normal
                    </span>
                  )}
                </div>
              )}
              <div className="text-[10px] text-gray-500 space-y-0.5">
                {recentClimate.tempMeanC !== undefined && recentClimate.tempMeanC !== null && (
                  <p>🌡 Media {recentClimate.tempMeanC.toFixed(1)}°C
                    {recentClimate.tempAnomalyC !== undefined && recentClimate.tempAnomalyC !== null && Math.abs(recentClimate.tempAnomalyC) >= 0.5 && (
                      <span className={`ml-1 font-bold ${recentClimate.tempAnomalyC > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                        ({recentClimate.tempAnomalyC > 0 ? '+' : ''}{recentClimate.tempAnomalyC.toFixed(1)}°C)
                      </span>
                    )}
                  </p>
                )}
                <p>☔ {recentClimate.daysWithRain} días con lluvia
                  {recentClimate.lastRainDaysAgo !== undefined && recentClimate.lastRainDaysAgo !== null && (
                    <span className="text-gray-400"> · última hace {recentClimate.lastRainDaysAgo}d</span>
                  )}
                </p>
                {recentClimate.et0TotalMm !== undefined && recentClimate.et0TotalMm !== null && (
                  <p>🌬 ET₀ {recentClimate.et0TotalMm.toFixed(0)} mm</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Block 4 — Landsat thermal LST (Sprint Thermal)
             Badge contextualizado al estado del cultivo, no absoluto:
             - establishmentPhase=true O NDVI<0.30 → suelo dominantemente expuesto.
               Un delta LST-aire alto es física básica del suelo desnudo en
               primavera/verano, NO estrés del cultivo. Etiqueta neutra.
             - NDVI 0.30-0.45 → cobertura parcial. Se relajan los umbrales.
             - NDVI ≥ 0.45 → cobertura completa. Aplica el threshold estricto.
             Esto evita falsos positivos en cultivos jóvenes (caso Jonh pistacho). */}
        {thermal && (() => {
          const delta = thermal.lstDeltaAirC;
          let badge: { label: string; bg: string; text: string; border: string } | null = null;
          const cover = inferCoverLevel({ ndvi: currentNdvi, establishmentPhase });

          if (delta !== null && delta !== undefined) {
            if (cover === 'low') {
              // Suelo expuesto — neutralizamos. Es física del suelo desnudo, no estrés.
              badge = {
                label: establishmentPhase
                  ? `Suelo expuesto · esperable en establecimiento del ${cropLabel(cropType)}`
                  : 'Suelo expuesto · NDVI bajo',
                bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200',
              };
            } else if (cover === 'partial') {
              // Cobertura parcial — umbral más permisivo (suelo aún contribuye al LST).
              if (delta >= 12) badge = { label: 'Estrés térmico', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
              else if (delta >= 7) badge = { label: 'Templado', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' };
              else badge = { label: 'Sin estrés', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
            } else {
              // Cobertura completa — el delta refleja transpiración de la planta.
              if (delta >= 8) badge = { label: 'Estrés crítico', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
              else if (delta >= 5) badge = { label: 'Estrés térmico', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
              else if (delta >= 2) badge = { label: 'Templado', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' };
              else badge = { label: 'Sin estrés', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
            }
          }
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Térmico {thermal.days}d</span>
                <span className="text-[9px] text-gray-400">Landsat 30 m</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-900">{thermal.lstC.toFixed(1)}</p>
                <p className="text-xs text-gray-400">°C superficie</p>
              </div>
              <div className="space-y-1">
                {badge && (
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${badge.bg} ${badge.border}`}>
                    <span className={`text-[10px] font-bold ${badge.text}`}>{badge.label}</span>
                    {delta !== null && delta !== undefined && (
                      <span className={`text-[10px] font-bold ${badge.text}`}>
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)} °C vs aire
                      </span>
                    )}
                  </div>
                )}
                <div className="text-[10px] text-gray-500 space-y-0.5">
                  {thermal.airTempC !== undefined && thermal.airTempC !== null && (
                    <p>🌡 Aire {thermal.airTempC.toFixed(1)} °C (Open-Meteo)</p>
                  )}
                  <p>🛰 {thermal.scenesUsed} escena{thermal.scenesUsed !== 1 ? 's' : ''} L8/L9</p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
