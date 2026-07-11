import { useState, type ReactNode } from 'react';

/**
 * Calculadora Love Green (modo DRON) · 11-jul-2026.
 *
 * Modelo y dosis facilitados por JuanCho (base HTML del representante Love
 * Green vía WhatsApp), portados a FitoLink con la piel de AgroM. NO son las
 * dosis de la etiqueta del bote (que va en mínimos por prudencia) sino las
 * DOSIS DE TRABAJO del representante, por categoría de cultivo.
 *
 * Dos productos:
 *   1) LOVE GREEN (LG-MINER) — mineral SÓLIDO. Dosis en kg/ha.
 *   2) MICRO/PRO — líquido combinado 50% Microbiota (bacterias) + 50% Proenzime
 *      (alimento/enzimas). Al socio se lo entregan ya mezclado; el desglose 50/50
 *      es para quien lo echa por separado. Dosis en L/ha.
 *
 * Cálculo (fiel al original):
 *   agua total   = caldo/ha × superficie × nº aplicaciones
 *   por cuba     = (dosis/ha × 1000 ÷ caldo/ha) × capacidad de la cuba
 *   total prod.  = dosis/ha × superficie × nº aplicaciones
 * Regla no-inventar: si un dato no está en la fuente, no se rellena.
 */

// Dosis de trabajo por categoría (representante). Extensivo vs leñoso.
const CAT = {
  extensivo: { lgMin: 0.75, lgMax: 1, lgDef: 1, mpMin: 1.5, mpMax: 2, mpDef: 2 },
  lenoso: { lgMin: 1, lgMax: 1.5, lgDef: 1.5, mpMin: 2, mpMax: 3, mpDef: 3 },
} as const;
type Cat = keyof typeof CAT;

const CROPS: Array<{ id: string; nom: string; cat: Cat }> = [
  { id: 'maiz', nom: 'Maíz', cat: 'extensivo' },
  { id: 'girasol', nom: 'Girasol', cat: 'extensivo' },
  { id: 'trigo', nom: 'Trigo / cereal', cat: 'extensivo' },
  { id: 'patata', nom: 'Patata', cat: 'extensivo' },
  { id: 'horticola', nom: 'Hortícola', cat: 'extensivo' },
  { id: 'olivo', nom: 'Olivo', cat: 'lenoso' },
  { id: 'vina', nom: 'Viña', cat: 'lenoso' },
  { id: 'frutal', nom: 'Frutal / almendro', cat: 'lenoso' },
  { id: 'citricos', nom: 'Cítricos', cat: 'lenoso' },
];

const CUBA_PRESETS = [16, 50, 100, 300, 1000];

const fmt = (n: number, d = 0) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtAuto = (n: number, maxD = 2) => n.toLocaleString('es-ES', { maximumFractionDigits: maxD });

// Sólido: g → g/kg. Líquido: mL → mL/L.
function fmtCant(v: number, solido: boolean): { n: string; u: string } {
  if (solido) return v >= 1000 ? { n: fmtAuto(v / 1000), u: 'kg' } : { n: fmtAuto(v, 0), u: 'g' };
  return v >= 1000 ? { n: fmtAuto(v / 1000), u: 'L' } : { n: fmtAuto(v, 0), u: 'mL' };
}

// ── Átomos AgroM ─────────────────────────────────────────────────────────────
const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-earth-700/70">{children}</p>
);
const Label = ({ children }: { children: ReactNode }) => (
  <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-gray-400">{children}</span>
);
const numCls =
  'w-full rounded-lg border border-earth-300/70 bg-white px-2.5 py-1.5 font-display text-base tabular-nums text-[#0F2A22] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40';
const selectCls =
  'w-full rounded-lg border border-earth-300/70 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40';

/** Fila de carga (por cuba): nombre + cifra en serif, con desglose opcional. */
function LoadRow({ n, name, cant, solido, sub, out }: { n: number; name: string; cant: number | null; solido: boolean; sub?: string; out?: boolean }) {
  const t = cant != null ? fmtCant(cant, solido) : null;
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 font-mono text-[10px] font-bold text-white">{n}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-gray-600">{name}</span>
          {t
            ? <span className={`font-display text-xl leading-none tabular-nums ${out ? 'text-terra-600' : 'text-brand-800'}`}>{t.n}<span className="ml-0.5 text-xs text-gray-400">{t.u}</span></span>
            : <span className="font-display text-xl text-gray-300">—</span>}
        </div>
        {sub && <p className="mt-0.5 text-[10px] leading-snug text-gray-500">{sub}</p>}
      </div>
    </li>
  );
}

interface Props {
  defaultAreaHa?: number;
}

export default function DoseCalculatorCard({ defaultAreaHa }: Props) {
  const [cultivo, setCultivo] = useState('maiz');
  const [supStr, setSupStr] = useState(defaultAreaHa ? String(defaultAreaHa) : '1');
  const [caldo, setCaldo] = useState(50);
  const [apps, setApps] = useState(1);
  const [cubaStr, setCubaStr] = useState(() => {
    try { return localStorage.getItem('fitolink.calc.cubaL') || '300'; } catch { return '300'; }
  });
  const setCuba = (v: string) => {
    setCubaStr(v);
    try { localStorage.setItem('fitolink.calc.cubaL', v); } catch { /* noop */ }
  };

  const crop = CROPS.find((c) => c.id === cultivo) ?? CROPS[0];
  const k = CAT[crop.cat];

  // Dosis: se auto-rellena al cambiar cultivo (default de la categoría) pero es editable.
  const [doseLG, setDoseLG] = useState<number>(k.lgDef);
  const [doseMP, setDoseMP] = useState<number>(k.mpDef);
  const [onLG, setOnLG] = useState(true);
  const [onMP, setOnMP] = useState(true);

  const changeCultivo = (id: string) => {
    setCultivo(id);
    const c = CROPS.find((x) => x.id === id) ?? CROPS[0];
    setDoseLG(CAT[c.cat].lgDef);
    setDoseMP(CAT[c.cat].mpDef);
  };

  const sup = Math.max(0, parseFloat(supStr) || 0);
  const cuba = Math.max(1, parseFloat(cubaStr) || 1);
  const lgOutRange = onLG && doseLG > 0 && (doseLG < k.lgMin || doseLG > k.lgMax);
  const mpOutRange = onMP && doseMP > 0 && (doseMP < k.mpMin || doseMP > k.mpMax);

  // Cálculo (fiel al original).
  const aguaTotal = caldo * sup * apps;
  const full = cuba > 0 ? Math.floor(aguaTotal / cuba) : 0;
  const resto = +(aguaTotal - full * cuba).toFixed(2);
  const nCubas = full + (resto > 0 ? 1 : 0);

  const perCuba = (dosisHa: number) => (dosisHa * 1000 / caldo) * cuba; // g o mL en una cuba llena
  const perResto = (dosisHa: number) => (dosisHa * 1000 / caldo) * resto;
  const total = (dosisHa: number) => dosisHa * sup * apps; // kg o L

  const activos = [
    onLG && { key: 'lg', name: 'Love Green', solido: true, dosisHa: doseLG, unit: 'kg', out: lgOutRange, split: false as const },
    onMP && { key: 'mp', name: 'Micro/Pro', solido: false, dosisHa: doseMP, unit: 'L', out: mpOutRange, split: true as const },
  ].filter(Boolean) as Array<{ key: string; name: string; solido: boolean; dosisHa: number; unit: string; out: boolean; split: boolean }>;

  return (
    <div className="h-full overflow-hidden rounded-xl border border-earth-300/50 bg-[#FBF8F2]">
      {/* Cabecera + cuba */}
      <div className="flex items-center justify-between gap-2 border-b border-earth-300/40 bg-white/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <img src="/service-fertilization.svg" alt="" className="h-6 w-6 flex-shrink-0" />
          <Eyebrow>Calculadora Love Green · dron</Eyebrow>
        </div>
        <label className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-gray-400">Cuba</span>
          <span className="relative">
            <input type="number" step="any" min="1" value={cubaStr} onChange={(e) => setCuba(e.target.value)}
              className="w-20 rounded-lg border border-earth-300/70 bg-white py-1 pl-2.5 pr-6 font-display text-base tabular-nums text-[#0F2A22] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40" />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-gray-400">L</span>
          </span>
        </label>
      </div>

      <div className="space-y-3 px-4 py-3.5">
        {/* Parámetros */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <label className="col-span-2 block">
            <Label>Cultivo</Label>
            <select value={cultivo} onChange={(e) => changeCultivo(e.target.value)} className={selectCls}>
              {CROPS.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <span className="mt-1 block text-[10px] font-medium text-brand-600">
              {crop.cat === 'lenoso' ? 'Leñoso · dosis alta' : 'Extensivo · dosis estándar'}
            </span>
          </label>
          <label className="block">
            <Label>Superficie (ha)</Label>
            <input type="number" step="any" min="0" value={supStr} onChange={(e) => setSupStr(e.target.value)} className={numCls} />
          </label>
          <div className="block">
            <Label>Nº aplicaciones (ciclo)</Label>
            <div className="flex items-stretch overflow-hidden rounded-lg border border-earth-300/70 bg-white">
              <button type="button" onClick={() => setApps((a) => Math.max(1, a - 1))} className="px-3 font-display text-lg text-brand-700 hover:bg-earth-50">−</button>
              <span className="flex flex-1 items-center justify-center font-display text-lg tabular-nums text-[#0F2A22]">{apps}</span>
              <button type="button" onClick={() => setApps((a) => Math.min(9, a + 1))} className="px-3 font-display text-lg text-brand-700 hover:bg-earth-50">+</button>
            </div>
          </div>
          <label className="col-span-2 block">
            <div className="flex items-baseline justify-between">
              <Label>Caldo · agua (L/ha)</Label>
              <span className="font-display text-base tabular-nums text-brand-800">{caldo}<span className="ml-0.5 text-[10px] text-gray-400">L/ha</span></span>
            </div>
            <input type="range" min={20} max={150} step={5} value={caldo} onChange={(e) => setCaldo(+e.target.value)} className="w-full accent-brand-600" />
            <span className="mt-0.5 block text-[10px] text-gray-400">Referencia del representante: ~50 L/ha.</span>
          </label>
          <div className="col-span-2 flex flex-wrap gap-1.5">
            {CUBA_PRESETS.map((v) => (
              <button key={v} type="button" onClick={() => setCuba(String(v))}
                className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${cuba === v ? 'border-brand-600 bg-brand-600 text-white' : 'border-earth-300/70 bg-white text-gray-500 hover:border-brand-300'}`}>
                {v} L
              </button>
            ))}
          </div>
        </div>

        {/* Productos y dosis */}
        <div className="rounded-lg border border-earth-300/50 bg-white/50 p-3">
          <Eyebrow>Dosis por hectárea · editable</Eyebrow>
          {[
            { on: onLG, setOn: setOnLG, name: 'Love Green', tag: 'mineral, sólido', dose: doseLG, setDose: setDoseLG, unit: 'kg/ha', step: 0.05, ref: `${fmt(k.lgMin, 2)}–${fmt(k.lgMax, 2)} kg/ha`, out: lgOutRange },
            { on: onMP, setOn: setOnMP, name: 'Micro/Pro', tag: '50% microbiota + 50% proenzime, líquido', dose: doseMP, setDose: setDoseMP, unit: 'L/ha', step: 0.1, ref: `${fmt(k.mpMin, 1)}–${fmt(k.mpMax, 1)} L/ha`, out: mpOutRange },
          ].map((p, i) => (
            <div key={p.name} className={`flex items-start justify-between gap-3 py-2.5 ${i > 0 ? 'border-t border-earth-300/40' : ''} ${p.on ? '' : 'opacity-45'}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0F2A22]">{p.name} <span className="font-normal text-[10px] text-gray-400">· {p.tag}</span></p>
                <div className="mt-1.5 flex items-center gap-2">
                  <input type="number" min="0" step={p.step} value={p.dose} disabled={!p.on}
                    onChange={(e) => p.setDose(Math.max(0, +e.target.value || 0))}
                    className={`w-24 rounded-lg border px-2 py-1.5 text-center font-display text-lg tabular-nums focus:ring-2 focus:ring-brand-500/40 ${p.out ? 'border-terra-400 bg-terra-50 text-terra-700' : 'border-earth-300/70 bg-white text-brand-800'}`} />
                  <span className="text-xs font-semibold text-gray-500">{p.unit}</span>
                </div>
                <p className={`mt-1 text-[10px] ${p.out ? 'text-terra-600 font-medium' : 'text-gray-400'}`}>
                  Trabajo {crop.nom.toLowerCase()}: <b className={p.out ? 'text-terra-600' : 'text-brand-700'}>{p.ref}</b>{p.out ? ' · fuera de rango' : ''}
                </p>
              </div>
              <button type="button" role="switch" aria-checked={p.on} onClick={() => p.setOn(!p.on)}
                className={`mt-1 h-6 w-11 flex-shrink-0 rounded-full border transition-colors ${p.on ? 'border-brand-600 bg-brand-600' : 'border-earth-300 bg-earth-100'}`}>
                <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${p.on ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>

        {/* Plan de carga — por cuba */}
        <div className="rounded-lg border-l-2 border-terra-500 bg-earth-100/50 p-3">
          <Eyebrow>Plan de carga · {nCubas} cuba{nCubas !== 1 ? 's' : ''}{full > 0 ? ` · cada llena cubre ${fmtAuto(cuba / caldo, 1)} ha` : ''}</Eyebrow>
          {activos.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">Activa al menos un producto.</p>
          ) : (
            <>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-gray-400">En cada cuba llena de {fmt(cuba)} L:</p>
              <ol className="mt-1.5 space-y-2">
                <LoadRow n={1} name="Agua" cant={cuba * 1000} solido={false} out={false} />
                {activos.map((p, i) => (
                  <LoadRow key={p.key} n={i + 2} name={p.name} cant={sup > 0 ? perCuba(p.dosisHa) : null} solido={p.solido} out={p.out}
                    sub={p.split && sup > 0 ? `${fmtCant(perCuba(p.dosisHa) / 2, false).n} ${fmtCant(perCuba(p.dosisHa) / 2, false).u} microbiota + otro tanto proenzime` : undefined} />
                ))}
              </ol>
              {resto > 0 && full > 0 && (
                <p className="mt-2 rounded-md bg-white/60 px-2.5 py-1.5 text-[11px] text-gray-600">
                  {full} cuba{full !== 1 ? 's' : ''} llena{full !== 1 ? 's' : ''} + <b>1 última de {fmt(resto, resto % 1 ? 1 : 0)} L</b>
                  {activos.length > 0 && sup > 0 ? ` (en ella: ${activos.map((p) => { const t = fmtCant(perResto(p.dosisHa), p.solido); return `${p.name} ${t.n} ${t.u}`; }).join(' · ')})` : ''}
                </p>
              )}
              {(lgOutRange || mpOutRange) && (
                <p className="mt-2 rounded-md border border-terra-200 bg-terra-50 px-2.5 py-1.5 text-[11px] font-medium text-terra-700">
                  Dosis fuera de la horquilla de trabajo del representante. Consulte a su técnico.
                </p>
              )}
            </>
          )}
        </div>

        {/* Totales del trabajo */}
        {activos.length > 0 && sup > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-earth-300/50 bg-white/50 p-2.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-gray-400">Agua total</p>
              <p className="font-display text-xl tabular-nums text-brand-800">{fmt(aguaTotal, aguaTotal % 1 ? 1 : 0)}<span className="ml-0.5 text-xs text-gray-400">L</span></p>
            </div>
            {activos.map((p) => {
              const t = total(p.dosisHa);
              return (
                <div key={p.key} className="rounded-lg border border-earth-300/50 bg-white/50 p-2.5">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-gray-400">Total {p.name}</p>
                  <p className="font-display text-xl tabular-nums text-brand-800">{fmtAuto(t)}<span className="ml-0.5 text-xs text-gray-400">{p.unit}</span></p>
                  {p.split && <p className="mt-0.5 text-[10px] text-gray-500">micro {fmtAuto(t / 2)} + pro {fmtAuto(t / 2)} {p.unit}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Aviso de mezcla */}
        {onLG && onMP && (
          <div className="rounded-lg border border-earth-300/50 border-l-2 border-l-earth-500 bg-white/50 p-3">
            <p className="text-[11px] leading-relaxed text-gray-600">
              <b className="text-[#0F2A22]">Cuidado con la mezcla:</b> Love Green es alcalino y el Micro/Pro ácido; pueden reaccionar en la cuba. Prueba de compatibilidad antes, o pasadas separadas. Limpiar depósitos tras aplicar.
            </p>
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-gray-400">
          Dosis de trabajo del representante Love Green (no la etiqueta del bote, que va en mínimos) · caldo ~50 L/ha.
        </p>
      </div>
    </div>
  );
}
