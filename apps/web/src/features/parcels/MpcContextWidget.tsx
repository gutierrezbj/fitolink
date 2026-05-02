/**
 * Microsoft Planetary Computer context widget — Sprint MPC.
 *
 * Surfaces the long-term context that distinguishes FitoLink from a
 * "this week's NDVI" service: 5-year MODIS baseline + climate normals +
 * 30-day actual weather anomaly. All free, all global.
 */

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
}: Props) {
  const hasAny = modisBaseline || climateBaseline || recentClimate;
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

      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      </div>
    </div>
  );
}
