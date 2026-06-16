/**
 * Sección 2 · MOTOR DEL CUÁNDO — fecha óptima de cosecha (dolor nº1 del fondo).
 *
 * Muestra la SEÑAL REAL que el motor lee: la trayectoria de envero (NDRE de
 * otoño) de la parcela, año a año. Y es HONESTO sobre dos cosas:
 *  - el motor está validado en prueba (datos sintéticos); la fecha REAL de esta
 *    finca se calibra con el histórico de cosecha del fondo (B);
 *  - a nivel de parcela el envero es débil (el suelo del secano diluye la señal
 *    del fruto) → por eso hace falta el dron tree-level (C).
 * NO se muestra ninguna fecha de cosecha. Eso no existe aún.
 */
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea,
} from 'recharts';
import {
  buildAutumnTrajectories, latestAutumnEnvero, AUTUMN_TICKS, autumnTickLabel, CAMPAIGN_COLORS,
  type NdviReading,
} from './predictionUtils.js';
import { COMPLETE_CAMPAIGNS } from './encinenoFeaturesRef.js';

function TimingTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
}) {
  if (!active || !payload?.length) return null;
  const pts = payload.filter((p) => p.value != null);
  if (!pts.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-xs">
      {pts.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name.replace('y', '')}</span>
          </span>
          <span className="font-bold tabular-nums text-gray-700">{p.value.toFixed(3)}</span>
        </div>
      ))}
      <p className="text-[10px] text-gray-400 mt-1 pt-1 border-t border-gray-100">NDRE de otoño</p>
    </div>
  );
}

export default function HarvestTimingCard({ ndviHistory }: { ndviHistory: NdviReading[] }) {
  const { years, rows } = buildAutumnTrajectories(ndviHistory);
  const envero = latestAutumnEnvero(ndviHistory);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      {/* Header */}
      <div className="bg-brand-600 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-100">
          § Motor del «cuándo» · envero + calor
        </p>
        <h3 className="font-display text-xl text-white leading-tight mt-0.5">
          Cuándo cosechar
        </h3>
        <p className="text-[11px] text-brand-100/90 mt-0.5">
          Cosechar a tiempo frente a tarde mueve el 20–25 % del valor de la campaña.
        </p>
      </div>

      <div className="p-4">
        <p className="text-xs text-gray-600 leading-relaxed mb-3">
          El motor lee la <span className="font-semibold text-gray-800">maduración</span> por
          la caída del NDRE en otoño (envero) y el <span className="font-semibold text-gray-800">calor
          acumulado</span> (GDD). Aquí está la señal real de la finca, año a año:
        </p>

        {/* Trayectorias de envero (REAL) */}
        {years.length >= 2 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
              <ReferenceArea x1={244} x2={335} fill="#f5e6cc" fillOpacity={0.35} />
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0ec" vertical={false} />
              <XAxis
                dataKey="doy" type="number" domain={[244, 340]}
                ticks={AUTUMN_TICKS} tickFormatter={autumnTickLabel}
                tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                width={42} tickFormatter={(v: number) => v.toFixed(2)}
              />
              <Tooltip content={<TimingTooltip />} />
              {years.map((y) => (
                <Line
                  key={y} dataKey={`y${y}`} name={`y${y}`}
                  stroke={CAMPAIGN_COLORS[y] ?? '#46632e'} strokeWidth={2}
                  dot={{ r: 2.5 }} activeDot={{ r: 4 }} connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-lg">
            Esperando lecturas de otoño suficientes…
          </div>
        )}

        {/* Leyenda de campañas */}
        {years.length >= 2 && (
          <div className="flex items-center gap-3 justify-end flex-wrap mt-1">
            {years.map((y) => (
              <span key={y} className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 inline-block" style={{ background: CAMPAIGN_COLORS[y] ?? '#46632e' }} />
                <span className="text-[11px] text-gray-500">{y}</span>
              </span>
            ))}
            <span className="text-[10px] font-mono uppercase tracking-wider text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              Señal real · sep–nov
            </span>
          </div>
        )}

        {/* GDD por campaña (real) */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {COMPLETE_CAMPAIGNS.map((c) => (
            <div key={c.year} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 text-center">
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{c.year}</p>
              <p className="text-base font-bold tabular-nums text-gray-800 mt-0.5">
                {c.gddTotal.toLocaleString('es-ES')}
              </p>
              <p className="text-[9px] text-gray-400">GDD · calor</p>
            </div>
          ))}
        </div>

        {/* Estado honesto del motor */}
        <div className="mt-4 flex items-center gap-2 flex-wrap text-[11px]">
          <span className="font-mono uppercase tracking-wider text-earth-700 bg-earth-50 border border-earth-200 rounded-full px-2 py-0.5">
            Motor validado en prueba (datos sintéticos)
          </span>
          <span className="text-gray-400">→</span>
          <span className="font-mono uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            La fecha real se calibra con B (vuestro histórico)
          </span>
        </div>

        {/* El argumento técnico del dron */}
        <p className="text-[11px] text-gray-500 leading-snug mt-3 border-t border-gray-100 pt-2.5">
          A nivel de parcela la señal de envero es <span className="font-semibold text-gray-700">débil</span>:
          el suelo desnudo del secano diluye la maduración del fruto. Por eso el vuelo con
          dron <span className="font-semibold text-gray-700">(C)</span> baja la lectura a la copa,
          donde el envero sí se aísla. El dato de parcela demuestra el límite; el dron lo rompe.
        </p>
      </div>
    </div>
  );
}
