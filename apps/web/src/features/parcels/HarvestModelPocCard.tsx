/**
 * Modelo de cosecha · Prueba de concepto (POC).
 *
 * Sección HONESTA que enmarca el modelo predictivo (cuándo + cuánto) sobre la
 * parcela. NO muestra predicciones falsas: los motores están validados con
 * datos sintéticos (la "fábrica"), pero el modelo REAL necesita el histórico de
 * cosecha del fondo (B) y el vuelo con dron (C). Aquí mostramos el estado A/B/C
 * y la señal REAL de maduración (envero NDRE de otoño) que el modelo lee.
 *
 * Se muestra solo en olivar — es la POC del fondo Encineño. Regla nº1: no
 * inventar. Etiquetas claras de "prueba de concepto" / "en calibración".
 */
import { Link } from 'react-router-dom';

interface NdviReading {
  date: string | Date;
  mean: number;
  ndreValue?: number;
  ndmiValue?: number;
}

interface Props {
  ndviHistory: NdviReading[];
}

/** Última señal de envero: nivel de NDRE en otoño (sep-nov) — el proxy de maduración. */
function autumnEnvero(
  history: NdviReading[],
): { level: number; n: number; year: number } | null {
  const autumn = history.filter((r) => {
    const m = new Date(r.date).getMonth() + 1;
    return m >= 9 && m <= 11 && r.ndreValue != null;
  });
  if (autumn.length < 3) return null;
  const last = autumn[autumn.length - 1];
  return {
    level: last.ndreValue as number,
    n: autumn.length,
    year: new Date(last.date).getFullYear(),
  };
}

const STEPS = [
  {
    key: 'A',
    done: true,
    title: 'Señal + motor',
    desc: 'Señal multimodal (satélite + clima) y motor de predicción validado.',
  },
  {
    key: 'B',
    done: false,
    title: 'Datos del fondo',
    desc: 'Histórico de cosecha: kg, fechas y madurez por campaña — para entrenar.',
  },
  {
    key: 'C',
    done: false,
    title: 'Vuelo con dron',
    desc: 'Detalle árbol por árbol (carga y maduración). Capacidad propia.',
  },
];

export default function HarvestModelPocCard({ ndviHistory }: Props) {
  const envero = autumnEnvero(ndviHistory);
  const nReadings = ndviHistory.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Modelo de cosecha</h2>
        <span className="text-[10px] font-bold uppercase tracking-wider text-terra-600 bg-terra-50 border border-terra-500/30 rounded-full px-2 py-0.5">
          Prueba de concepto
        </span>
      </div>

      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Predice el{' '}
        <span className="font-semibold text-gray-700">momento óptimo de cosecha</span> y el{' '}
        <span className="font-semibold text-gray-700">rendimiento</span>, a partir de la
        señal satelital, el clima y el vuelo con dron. Fase 0 — en desarrollo.
      </p>

      {/* Estado A / B / C */}
      <div className="space-y-2 mb-4">
        {STEPS.map((s) => (
          <div key={s.key} className="flex items-start gap-3">
            <span
              className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                s.done ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {s.done ? '✓' : s.key}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800">
                {s.title}
                {s.done ? (
                  <span className="ml-2 text-[10px] font-medium text-green-600">listo</span>
                ) : (
                  <span className="ml-2 text-[10px] font-medium text-amber-600">pendiente</span>
                )}
              </p>
              <p className="text-[11px] text-gray-500 leading-snug">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Las dos salidas — sin números inventados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
              Cuándo cosechar
            </p>
            <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
              en calibración
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1.5 leading-snug">
            Lee el <span className="font-medium">envero</span> (NDRE de otoño) y el calor acumulado.
          </p>
          {envero ? (
            <p className="text-[11px] text-gray-500 mt-1.5">
              Señal de maduración detectada · NDRE otoño{' '}
              <span className="font-bold tabular-nums text-gray-700">
                {envero.level.toFixed(3)}
              </span>{' '}
              ({envero.year})
            </p>
          ) : (
            <p className="text-[11px] text-gray-400 mt-1.5">Esperando lecturas de otoño…</p>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
              Cuántos kilos
            </p>
            <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
              en calibración
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1.5 leading-snug">
            Cruza vigor, agua y carga por árbol con el histórico de kg.
          </p>
          <p className="text-[11px] text-gray-500 mt-1.5">
            Necesita el rendimiento del fondo + el censo por dron.
          </p>
        </div>
      </div>

      {/* Footer honesto */}
      <p className="text-[10px] text-gray-400 mt-3 leading-snug border-t border-gray-100 pt-2.5">
        {nReadings} lecturas reales de la finca cargadas. Las predicciones se activan
        cuando el fondo aporte su histórico (B) y se vuele el dron (C). Prototipo en
        validación — no es un dato definitivo.
      </p>

      <Link
        to="/dashboard/prediction"
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
      >
        Ver predicción completa →
      </Link>
    </div>
  );
}
