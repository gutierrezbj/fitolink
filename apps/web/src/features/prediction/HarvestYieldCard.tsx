/**
 * Sección 3 · MOTOR DEL CUÁNTO — rendimiento (dolor nº2 del fondo).
 *
 * Enseña el DRIVER real y físicamente observable del rendimiento en secano:
 * más lluvia de primavera → más vigor acumulado. Es "miradlo", no "creednos".
 * HONESTO hasta el tuétano:
 *  - solo las 3 campañas COMPLETAS sostienen la señal; 2022 y 2026 (parciales)
 *    se dibujan atenuadas y FUERA de la tendencia;
 *  - n=3 es señal observable, NO validación estadística;
 *  - NO se muestra ningún kg. El kg necesita el target del fondo (B) + el censo
 *    por árbol del dron (C).
 */
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ENCINENO_CAMPAIGNS } from './encinenoFeaturesRef.js';

const DATA = [...ENCINENO_CAMPAIGNS]
  .sort((a, b) => a.rainSpring - b.rainSpring)
  .map((c) => ({
    year: c.year,
    rainSpring: c.rainSpring,
    vigor: c.vigorIntegral,
    complete: c.complete,
    // La línea de tendencia solo une las campañas completas.
    vigorTrend: c.complete ? c.vigorIntegral : null,
  }));

function CampaignPoint(props: { cx?: number; cy?: number; payload?: typeof DATA[number] }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const complete = payload.complete;
  return (
    <g>
      <circle
        cx={cx} cy={cy} r={complete ? 7 : 5.5}
        fill={complete ? '#46632e' : 'none'}
        stroke={complete ? '#46632e' : '#b8b8a8'}
        strokeWidth={2}
        strokeDasharray={complete ? undefined : '2 2'}
      />
      <text
        x={cx + 11} y={cy} dy={4}
        fontSize={complete ? 11 : 10}
        fontWeight={complete ? 700 : 400}
        fill={complete ? '#18230f' : '#9ca3af'}
      >
        {payload.year}{complete ? '' : ' · parcial'}
      </text>
    </g>
  );
}

function YieldTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: typeof DATA[number] }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-xs">
      <p className="font-semibold text-gray-900 mb-1">
        Campaña {d.year}{d.complete ? '' : ' (parcial)'}
      </p>
      <div className="flex justify-between gap-4">
        <span className="text-gray-500">Lluvia primavera</span>
        <span className="font-bold tabular-nums text-sky-700">{d.rainSpring} mm</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-500">Vigor acumulado</span>
        <span className="font-bold tabular-nums text-brand-600">{d.vigor.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function HarvestYieldCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      {/* Header */}
      <div className="bg-brand-600 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-100">
          § Motor del «cuánto» · agua → vigor → carga
        </p>
        <h3 className="font-display text-xl text-white leading-tight mt-0.5">
          Cuánto va a producir
        </h3>
        <p className="text-[11px] text-brand-100/90 mt-0.5">
          El driver del rendimiento en secano, observable en la propia finca.
        </p>
      </div>

      <div className="p-4">
        <p className="text-xs text-gray-600 leading-relaxed mb-3">
          Más <span className="font-semibold text-sky-700">lluvia de primavera</span> → más{' '}
          <span className="font-semibold text-brand-600">vigor acumulado</span>. La relación es
          monótona en las tres campañas completas de Encineño. No es una promesa: es lo que dice
          su propio satélite.
        </p>

        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={DATA} margin={{ top: 12, right: 64, bottom: 22, left: -4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0ec" />
            <XAxis
              dataKey="rainSpring" type="number" domain={[40, 450]}
              tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
              label={{ value: 'lluvia de primavera (mm)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#9ca3af' }}
            />
            <YAxis
              dataKey="vigor" type="number" domain={[0, 20]}
              tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
              width={36}
              label={{ value: 'vigor', angle: -90, position: 'insideLeft', offset: 16, fontSize: 11, fill: '#9ca3af' }}
            />
            <Tooltip content={<YieldTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Line
              dataKey="vigorTrend" stroke="#d45220" strokeWidth={1.8} strokeDasharray="5 4"
              dot={false} activeDot={false} connectNulls legendType="none" isAnimationActive={false}
            />
            <Scatter dataKey="vigor" shape={<CampaignPoint />} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Banner honesto n=3 */}
        <div className="flex items-start gap-2 mt-1 p-2.5 bg-earth-50 border border-earth-200 rounded-lg">
          <span className="text-earth-600 mt-0.5">ⓘ</span>
          <p className="text-[11px] text-earth-800 leading-snug">
            <span className="font-semibold">n = 3 no es validación estadística</span> — es una señal
            observable. Las campañas 2022 y 2026 (medio año de satélite) quedan fuera de la tendencia.
          </p>
        </div>

        {/* Estado honesto */}
        <p className="text-[11px] text-gray-500 leading-snug mt-3 border-t border-gray-100 pt-2.5">
          El motor (validado en prueba) recupera el agua de primavera como driver dominante. Para
          convertir el vigor en <span className="font-semibold text-gray-700">kilos</span> hacen falta
          dos cosas que no tenemos aún: <span className="font-semibold text-gray-700">(B)</span> vuestro
          histórico de rendimiento y <span className="font-semibold text-gray-700">(C)</span> el censo
          de carga por árbol con dron. Por eso aquí no verá ninguna cifra de kg: todavía no existe.
        </p>
      </div>
    </div>
  );
}
