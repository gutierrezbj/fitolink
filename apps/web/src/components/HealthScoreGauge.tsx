import { inferCoverLevel } from '@fitolink/shared';

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

export default function HealthScoreGauge({ ndvi, size = 120, showLabel = true, establishmentPhase }: HealthScoreGaugeProps) {
  const score = ndvi !== null && ndvi !== undefined ? ndviToScore(ndvi) : null;
  const cover = inferCoverLevel({ ndvi, establishmentPhase });

  // Cuando el cultivo está en establecimiento (suelo dominantemente expuesto),
  // un NDVI bajo es esperable y no diagnostica salud — el dial absoluto sería
  // engañoso (rojo Crítico contradice al resto del UI que dice "valor esperable").
  // Neutralizamos a gris y cambiamos la etiqueta.
  const colors = score === null
    ? { stroke: '#94a3b8', text: 'text-gray-400', label: 'Sin datos' }
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
          {ndvi !== null && ndvi !== undefined && (
            <p className="text-[11px] text-gray-400">NDVI {ndvi.toFixed(3)}</p>
          )}
        </div>
      )}
    </div>
  );
}
