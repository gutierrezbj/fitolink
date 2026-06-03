import { inferCoverLevel, isCalibrating, calibrationDaysLeft } from '@fitolink/shared';

interface HealthScoreGaugeProps {
  ndvi: number | null;
  size?: number;
  showLabel?: boolean;
  /**
   * Flag manual de Parcel.establishmentPhase. Si true (o si el NDVI da
   * cover='low'), el gauge no etiqueta como Crítico/Riesgo — un cultivo
   * en establecimiento tiene NDVI bajo por física del suelo expuesto,
   * no por estrés. 6º cross-cutting fix del Sprint Contexto del Cultivo
   * tras los 5 originales del 13-may-2026.
   */
  establishmentPhase?: boolean;
  /**
   * Parcel.calibratingUntil — fecha hasta la cual la parcela está en
   * modo Calibración pasiva (agricultor no informó plantingYear al alta).
   * Mientras Date.now() < calibratingUntil, el gauge pasa a "Calibrando"
   * con días restantes en lugar de mostrar un score puntual potencialmente
   * engañoso sobre datos insuficientes. Sprint Calibración del Cultivo
   * paso 3 (UI calibrando) · 14-may-2026.
   *
   * Precedencia: calibratingUntil > establishmentPhase > score absoluto.
   * Una parcela puede estar calibrando Y ser potencialmente joven — la
   * etiqueta correcta para el día 1 es "Calibrando".
   */
  calibratingUntil?: Date | string | null;
}

function ndviToScore(ndvi: number): number {
  return Math.round(Math.max(0, Math.min(100, ndvi * 100)));
}

function scoreToColor(score: number): { stroke: string; text: string; label: string } {
  if (score >= 60) return { stroke: '#22c55e', text: 'text-green-600', label: 'Saludable' };
  if (score >= 40) return { stroke: '#eab308', text: 'text-yellow-600', label: 'Atencion' };
  if (score >= 25) return { stroke: '#f97316', text: 'text-orange-600', label: 'Riesgo' };
  return { stroke: '#ef4444', text: 'text-red-600', label: 'Critico' };
}

// Tono neutro para cultivos en establecimiento: gris-tierra, sin alarma.
const ESTABLISHMENT_LOOK = {
  stroke: '#9ca3af',           // gray-400 — neutro, no estridente
  text: 'text-gray-600',
  label: 'En establecimiento',
};

// Tono cálido para parcelas en modo Calibración: ocre/arena, sugiere
// "el sistema está observando, aún no diagnostica". Distinto del gris
// de establecimiento porque la causa es distinta — aquí falta info, no
// es contexto agronómico.
const CALIBRATION_LOOK = {
  stroke: '#d4a85a',           // earth-300, tono arena cálido
  text: 'text-earth-700',
  label: 'Calibrando',
};

export default function HealthScoreGauge({ ndvi, size = 120, showLabel = true, establishmentPhase, calibratingUntil }: HealthScoreGaugeProps) {
  const score = ndvi !== null && ndvi !== undefined ? ndviToScore(ndvi) : null;
  const cover = inferCoverLevel({ ndvi, establishmentPhase });
  const calibrating = isCalibrating({ calibratingUntil });
  const daysLeft = calibrationDaysLeft({ calibratingUntil });

  // Precedencia: calibrating > establecimiento > score absoluto.
  // Sin datos → gris "Sin datos". Calibrando → ocre "Calibrando". Cover
  // low (establecimiento) → gris "En establecimiento". Resto → score normal.
  const colors = score === null
    ? { stroke: '#94a3b8', text: 'text-gray-400', label: 'Sin datos' }
    : calibrating
      ? CALIBRATION_LOOK
      : cover === 'low'
        ? ESTABLISHMENT_LOOK
        : scoreToColor(score);

  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // Arc: 225deg start → 270deg total sweep (from bottom-left to bottom-right via top)
  const startAngle = 225;
  const totalAngle = 270;
  const endAngle = startAngle + totalAngle;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const describeArc = (start: number, end: number) => {
    const s = { x: cx + radius * Math.cos(toRad(start)), y: cy + radius * Math.sin(toRad(start)) };
    const e = { x: cx + radius * Math.cos(toRad(end)), y: cy + radius * Math.sin(toRad(end)) };
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const filledAngle = score !== null ? startAngle + (score / 100) * totalAngle : startAngle;
  const filledPath = score !== null && score > 0 ? describeArc(startAngle, filledAngle) : null;
  const trackPath = describeArc(startAngle, endAngle);

  const circumference = 2 * Math.PI * radius;
  const dashLength = (totalAngle / 360) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: size }} className="relative">
        <svg width={size} height={size} className="drop-shadow-sm">
          {/* Track */}
          <path d={trackPath} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} strokeLinecap="round" />

          {/* Filled arc */}
          {filledPath && (
            <path
              d={filledPath}
              fill="none"
              stroke={colors.stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{ transition: 'all 0.8s ease-out' }}
            />
          )}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {score !== null ? (
            <>
              <span className={`font-bold leading-none ${colors.text}`} style={{ fontSize: size * 0.22 }}>
                {score}
              </span>
              <span className="text-gray-400 leading-none" style={{ fontSize: size * 0.1 }}>
                / 100
              </span>
            </>
          ) : (
            <span className="text-gray-400" style={{ fontSize: size * 0.12 }}>—</span>
          )}
        </div>
      </div>

      {showLabel && (
        <div className="mt-1 text-center">
          <span className={`text-xs font-semibold ${colors.text}`}>{colors.label}</span>
          {calibrating ? (
            <p className="text-[11px] text-gray-400">
              faltan {daysLeft} día{daysLeft === 1 ? '' : 's'}
            </p>
          ) : ndvi !== null && ndvi !== undefined && (
            <p className="text-[11px] text-gray-400">NDVI {ndvi.toFixed(3)}</p>
          )}
        </div>
      )}
    </div>
  );
}
