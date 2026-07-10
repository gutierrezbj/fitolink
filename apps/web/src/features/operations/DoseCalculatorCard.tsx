import { useState, type ReactNode } from 'react';
import {
  PRODUCT_CATALOG,
  TANK_MIXES,
  APPLICATION_UNITS,
  labelRangeText,
  type ProductSpec,
  type TankMixSpec,
  type ApplicationUnit,
} from '@fitolink/shared';

/**
 * Calculadora de mezcla · "Ficha de carga" (rediseño editorial 10-jul-2026).
 *
 * Dirección de diseño: la calculadora se lee como la propia ETIQUETA del envase
 * (la tabla DOSIS MÍN./MÁX. hecha instrumento) cruzada con una hoja de campo.
 * La RESPUESTA es el protagonista — el técnico abre y ve, en serif grande,
 * cuánto producto y cuánta agua cargar. Marco cálido (paleta earth/paper),
 * medidor de dosis con marca deslizante, eyebrows mono, identidad en Instrument
 * Serif. Solo DATO, cero narrativa. Rangos = transcripción literal de etiqueta
 * (productCatalog.ts); fuera de rango se marca en terra — decide el técnico.
 */

type Via = 'dron' | 'pulverizador' | 'foliar' | 'riego';

const VIA_LABEL: Record<Via, string> = {
  dron: 'Dron',
  pulverizador: 'Pulverizador / atomizador',
  foliar: 'Foliar (% en agua)',
  riego: 'Riego (fertirrigación)',
};

const availableVias = (p: ProductSpec): Via[] =>
  (Object.keys(VIA_LABEL) as Via[]).filter((v) => p.methods[v]);

// Total legible: g→kg y mL→L cuando el acumulado pasa de 1000.
function fmtTotal(total: number, unitPerHa: string): { n: string; u: string } {
  const base = unitPerHa.split('/')[0];
  const f = (n: number, d: number) => n.toLocaleString('es-ES', { maximumFractionDigits: d });
  if (base === 'g') return total >= 1000 ? { n: f(total / 1000, 2), u: 'kg' } : { n: f(total, 1), u: 'g' };
  if (base === 'mL') return total >= 1000 ? { n: f(total / 1000, 2), u: 'L' } : { n: f(total, 1), u: 'mL' };
  return { n: f(total, 2), u: base };
}
const fmtEs = (n: number, d = 2) => n.toLocaleString('es-ES', { maximumFractionDigits: d });

// ── Átomos visuales ──────────────────────────────────────────────────────────

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-earth-700/70">{children}</p>
);

const Stamp = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center rounded-full border border-earth-400/50 bg-earth-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-earth-700">
    {children}
  </span>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-gray-400">{label}</span>
    {children}
  </label>
);

const inputCls = (warn = false) =>
  `w-full rounded-lg border px-3 py-2 font-display text-lg tabular-nums transition-colors focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 ${
    warn ? 'border-terra-400 bg-terra-50 text-terra-700' : 'border-earth-300/70 bg-white text-[#0F2A22]'
  }`;

const selectCls =
  'w-full rounded-lg border border-earth-300/70 bg-white px-2 py-2 text-sm focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500';

/** Medidor de dosis — la tabla DOSIS MÍN./MÁX. del envase hecha instrumento. */
function Gauge({ min, max, value, unit }: { min: number; max: number; value?: number | null; unit: string }) {
  const has = value != null && Number.isFinite(value) && value > 0;
  const raw = has ? (value! - min) / (max - min) : null;
  const pos = raw != null ? Math.max(0, Math.min(1, raw)) : null;
  const out = raw != null && (raw < 0 || raw > 1);
  return (
    <div className="pt-6">
      <div className="relative">
        {pos != null && (
          <span
            className={`absolute -top-5 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] font-semibold ${out ? 'text-terra-600' : 'text-brand-700'}`}
            style={{ left: `${pos * 100}%` }}
          >
            {fmtEs(value!)}
          </span>
        )}
        <div className="relative h-2 overflow-hidden rounded-full bg-earth-100 shadow-[inset_0_1px_2px_rgba(83,59,22,0.18)]">
          <div className={`absolute inset-y-0 left-0 ${out ? 'bg-terra-300' : 'bg-brand-300'}`} style={{ width: pos != null ? `${pos * 100}%` : 0 }} />
          {[0.25, 0.5, 0.75].map((t) => (
            <span key={t} className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-earth-300" style={{ left: `${t * 100}%` }} />
          ))}
        </div>
        {pos != null && (
          <span className={`absolute -top-0.5 h-3 w-[3px] -translate-x-1/2 rounded-full ${out ? 'bg-terra-600' : 'bg-brand-700'}`} style={{ left: `${pos * 100}%` }} />
        )}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[9px] uppercase tracking-wide text-gray-400">
        <span>mín {fmtEs(min)}</span>
        <span className="text-earth-700/60">{unit}</span>
        <span>máx {fmtEs(max)}</span>
      </div>
    </div>
  );
}

/** Cifra-héroe: el número que el técnico va a cargar, en serif editorial. */
function HeroStat({ n, u, label, tone = 'brand' }: { n: string; u: string; label: string; tone?: 'brand' | 'terra' | 'ink' }) {
  const color = tone === 'terra' ? 'text-terra-600' : tone === 'ink' ? 'text-[#0F2A22]' : 'text-brand-800';
  return (
    <div>
      <p className={`font-display leading-none tabular-nums ${color}`}>
        <span className="text-[2.1rem] sm:text-[2.5rem]">{n}</span>
        <span className="ml-1 text-lg text-gray-400">{u}</span>
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
    </div>
  );
}

/** Panel cálido de resultado — el "sello" de la ficha. */
const ResultPanel = ({ eyebrow, children }: { eyebrow: string; children: ReactNode }) => (
  <div className="rounded-xl border-l-2 border-terra-500 bg-earth-100/50 p-4 sm:p-5">
    <Eyebrow>{eyebrow}</Eyebrow>
    <div className="mt-3">{children}</div>
  </div>
);

const StepBadge = ({ n }: { n: number }) => (
  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 font-mono text-[11px] font-bold text-white">
    {n}
  </span>
);

const NoteList = ({ notes, source }: { notes?: string[]; source?: string }) => (
  <div className="space-y-1 border-t border-earth-300/40 pt-3">
    {notes?.map((n) => (
      <p key={n} className="text-[11px] leading-relaxed text-gray-500">· {n}</p>
    ))}
    {source && <p className="pt-1 text-[11px] leading-relaxed text-gray-400">{source}</p>}
  </div>
);

interface Props {
  defaultAreaHa?: number;
}

// ── Modo MEZCLA DE TANQUE — receta de carga en orden ─────────────────────────
function TankMixMode({ mix, areaStr, setAreaStr }: { mix: TankMixSpec; areaStr: string; setAreaStr: (v: string) => void }) {
  const [caldoStr, setCaldoStr] = useState('');
  const [doseStrs, setDoseStrs] = useState<Record<string, string>>({});

  const area = parseFloat(areaStr);
  const caldo = parseFloat(caldoStr);
  const hasArea = Number.isFinite(area) && area > 0;
  const hasCaldo = Number.isFinite(caldo) && caldo > 0;

  const comps = mix.components
    .map((c) => ({ ...c, spec: PRODUCT_CATALOG.find((p) => p.id === c.productId) }))
    .filter((c): c is typeof c & { spec: ProductSpec } => !!c.spec);

  const waterRange = comps.map((c) => c.spec.methods.dron?.waterLPerHa).find(Boolean);
  const caldoOut = hasCaldo && waterRange ? caldo < waterRange.min || caldo > waterRange.max : false;

  const rows = comps.map((c) => {
    const dose = parseFloat(doseStrs[c.productId] ?? '');
    const hasDose = Number.isFinite(dose) && dose > 0;
    const perHa = c.spec.methods.dron?.dose.unit === c.unit ? c.spec.methods.dron?.dose : undefined;
    const pct = c.spec.methods.foliar?.concentrationPct;
    const pctEquiv = hasDose && hasCaldo && c.unit === 'L/ha' ? (dose / caldo) * 100 : null;
    const out = hasDose
      ? perHa ? dose < perHa.min || dose > perHa.max
        : pct && pctEquiv != null ? pctEquiv < pct.min || pctEquiv > pct.max
        : false
      : false;
    return { ...c, dose, hasDose, out, perHa, pctRange: pct, pctEquiv, shortName: c.spec.name.split('·')[0].trim() };
  });
  const anyOut = rows.some((r) => r.out) || caldoOut;

  return (
    <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.05fr]">
      {/* Entradas + medidores */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 content-start">
        <Field label="Superficie (ha)">
          <input type="number" step="any" min="0" value={areaStr} onChange={(e) => setAreaStr(e.target.value)} className={inputCls()} />
        </Field>
        <Field label="Caldo · agua (L/ha)">
          <input type="number" step="any" min="0" value={caldoStr} onChange={(e) => setCaldoStr(e.target.value)} placeholder={waterRange ? `${waterRange.min}–${waterRange.max}` : ''} className={inputCls(caldoOut)} />
          {waterRange && <Gauge min={waterRange.min} max={waterRange.max} value={hasCaldo ? caldo : null} unit="L/ha" />}
        </Field>
        {rows.map((r) => (
          <Field key={r.productId} label={`${r.shortName} (${r.unit})`}>
            <input type="number" step="any" min="0" value={doseStrs[r.productId] ?? ''} onChange={(e) => setDoseStrs((m) => ({ ...m, [r.productId]: e.target.value }))} placeholder={r.perHa ? labelRangeText(r.perHa) : ''} className={inputCls(r.out)} />
            {r.perHa && <Gauge min={r.perHa.min} max={r.perHa.max} value={r.hasDose ? r.dose : null} unit={r.perHa.unit} />}
            {!r.perHa && r.pctRange && <Gauge min={r.pctRange.min} max={r.pctRange.max} value={r.pctEquiv} unit="% caldo" />}
          </Field>
        ))}
      </div>

      {/* Receta de carga — el resultado, en orden de incorporación */}
      <div className="flex flex-col gap-3">
        <ResultPanel eyebrow={`Receta de carga${hasArea ? ` · ${fmtEs(area)} ha` : ''}`}>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <StepBadge n={1} />
              <div className="flex flex-1 items-baseline justify-between gap-2">
                <span className="text-sm text-gray-600">Agua</span>
                {hasArea && hasCaldo
                  ? (() => { const r = fmtTotal(caldo * area, 'L/ha'); return <span className={`font-display text-2xl leading-none tabular-nums ${caldoOut ? 'text-terra-600' : 'text-brand-800'}`}>{r.n}<span className="ml-1 text-sm text-gray-400">{r.u}</span></span>; })()
                  : <span className="font-display text-2xl text-gray-300">—</span>}
              </div>
            </li>
            {rows.map((r, i) => (
              <li key={r.productId} className="flex items-start gap-3">
                <StepBadge n={i + 2} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-gray-600">{r.shortName}</span>
                    {hasArea && r.hasDose
                      ? (() => { const t = fmtTotal(r.dose * area, r.unit); return <span className={`font-display text-2xl leading-none tabular-nums ${r.out ? 'text-terra-600' : 'text-brand-800'}`}>{t.n}<span className="ml-1 text-sm text-gray-400">{t.u}</span></span>; })()
                      : <span className="font-display text-2xl text-gray-300">—</span>}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
                    {r.stepNote}
                    {r.pctEquiv != null && r.pctRange && (
                      <span className={r.out ? 'text-terra-600 font-medium' : 'text-gray-400'}> · ≈{fmtEs(r.pctEquiv, 1)}% del caldo</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {anyOut && (
            <p className="mt-3 rounded-lg border border-terra-200 bg-terra-50 px-3 py-2 text-xs font-medium text-terra-700">
              Hay valores fuera del rango de etiqueta. Consulte a su técnico.
            </p>
          )}
        </ResultPanel>
        <NoteList notes={mix.notes} source={mix.source} />
      </div>
    </div>
  );
}

// ── Modo PRODUCTO SUELTO ─────────────────────────────────────────────────────
function SingleProductMode({ product, areaStr, setAreaStr }: { product: ProductSpec; areaStr: string; setAreaStr: (v: string) => void }) {
  const [via, setVia] = useState<Via>(availableVias(product)[0] ?? 'dron');
  const [doseStr, setDoseStr] = useState('');
  const [caldoStr, setCaldoStr] = useState('');

  const vias = availableVias(product);
  const activeVia: Via = vias.includes(via) ? via : vias[0];

  const dose = parseFloat(doseStr);
  const caldo = parseFloat(caldoStr);
  const area = parseFloat(areaStr);
  const hasDose = Number.isFinite(dose) && dose > 0;
  const hasCaldo = Number.isFinite(caldo) && caldo > 0;
  const hasArea = Number.isFinite(area) && area > 0;

  const perHa = activeVia === 'dron' ? product.methods.dron?.dose
    : activeVia === 'pulverizador' ? product.methods.pulverizador?.dose
    : activeVia === 'riego' ? product.methods.riego?.dose
    : undefined;
  const pct = activeVia === 'foliar' ? product.methods.foliar?.concentrationPct : undefined;
  const rangeText = perHa ? labelRangeText(perHa) : pct ? `${pct.min}–${pct.max} %` : '';
  const outOfLabel = hasDose ? (perHa ? dose < perHa.min || dose > perHa.max : pct ? dose < pct.min || dose > pct.max : false) : false;
  const foliarProductPerHa = activeVia === 'foliar' && hasDose && hasCaldo ? (caldo * dose) / 100 : null;

  // Agua: en dron y foliar el técnico elige el CALDO (L/ha) → agua exacta en cuba
  // (no un rango). La etiqueta de dron da el rango válido (waterLPerHa) para el
  // medidor. En caldo fuera del rango de etiqueta se avisa.
  const dronWater = product.methods.dron?.waterLPerHa;
  const showCaldoInput = activeVia === 'foliar' || (activeVia === 'dron' && !!dronWater);
  const showWater = activeVia === 'dron' || activeVia === 'foliar';
  const caldoOut = activeVia === 'dron' && dronWater && hasCaldo ? caldo < dronWater.min || caldo > dronWater.max : false;
  const aguaTotal = hasArea && hasCaldo ? caldo * area : null;

  return (
    <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.05fr]">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 content-start">
        <Field label="Vía">
          <select value={activeVia} onChange={(e) => { setVia(e.target.value as Via); setDoseStr(''); setCaldoStr(''); }} className={selectCls}>
            {vias.map((v) => <option key={v} value={v}>{VIA_LABEL[v]}</option>)}
          </select>
        </Field>
        <Field label="Superficie (ha)">
          <input type="number" step="any" min="0" value={areaStr} onChange={(e) => setAreaStr(e.target.value)} className={inputCls()} />
        </Field>
        <Field label={activeVia === 'foliar' ? 'Concentración (%)' : `Dosis ${perHa ? `(${perHa.unit})` : ''}`}>
          <input type="number" step="any" min="0" value={doseStr} onChange={(e) => setDoseStr(e.target.value)} placeholder={rangeText} className={inputCls(outOfLabel)} />
          {perHa && <Gauge min={perHa.min} max={perHa.max} value={hasDose ? dose : null} unit={perHa.unit} />}
          {pct && <Gauge min={pct.min} max={pct.max} value={hasDose ? dose : null} unit="%" />}
        </Field>
        {showCaldoInput && (
          <Field label="Caldo · agua (L/ha)">
            <input type="number" step="any" min="0" value={caldoStr} onChange={(e) => setCaldoStr(e.target.value)} placeholder={activeVia === 'dron' && dronWater ? `${dronWater.min}–${dronWater.max}` : 'p.ej. 100'} className={inputCls(caldoOut)} />
            {activeVia === 'dron' && dronWater && <Gauge min={dronWater.min} max={dronWater.max} value={hasCaldo ? caldo : null} unit="L/ha" />}
          </Field>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <ResultPanel eyebrow={hasArea ? `Cargar en la cuba · ${fmtEs(area)} ha` : 'Cargar en la cuba'}>
          <div className="flex flex-wrap items-start gap-x-7 gap-y-4">
            {/* PRODUCTO — la dosis total a echar */}
            {activeVia === 'foliar' ? (
              foliarProductPerHa != null && hasArea
                ? (() => { const t = fmtTotal(foliarProductPerHa * area, 'L/ha'); return <HeroStat n={t.n} u={t.u} label="producto a echar" tone={outOfLabel ? 'terra' : 'brand'} />; })()
                : <HeroStat n="—" u="" label="producto a echar" tone="ink" />
            ) : (
              hasDose && hasArea && perHa
                ? (() => { const t = fmtTotal(dose * area, perHa.unit); return <HeroStat n={t.n} u={t.u} label="producto a echar" tone={outOfLabel ? 'terra' : 'brand'} />; })()
                : <HeroStat n="—" u="" label="producto a echar" tone="ink" />
            )}
            {/* AGUA — un solo número para llenar, según el caldo elegido */}
            {showWater && (
              <>
                <span className="self-center pt-1 font-display text-3xl text-earth-400">+</span>
                {aguaTotal != null
                  ? (() => { const t = fmtTotal(aguaTotal, 'L/ha'); return <HeroStat n={t.n} u={t.u} label="agua en cuba" tone={caldoOut ? 'terra' : 'ink'} />; })()
                  : <HeroStat n="—" u="L" label={activeVia === 'dron' ? 'agua · elige caldo' : 'agua · pon el caldo'} tone="ink" />}
              </>
            )}
          </div>

          <dl className="mt-4 space-y-1 border-t border-earth-300/40 pt-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Etiqueta · {VIA_LABEL[activeVia].toLowerCase()}</dt>
              <dd className="font-medium text-[#0F2A22]">{rangeText || '—'}</dd>
            </div>
            {activeVia === 'dron' && dronWater && (
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Caldo de etiqueta</dt>
                <dd className="font-medium text-[#0F2A22]">{dronWater.min}–{dronWater.max} L/ha</dd>
              </div>
            )}
            {activeVia === 'foliar' && foliarProductPerHa != null && (
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Producto por ha ({dose}% de {fmtEs(caldo)} L)</dt>
                <dd className="font-medium text-[#0F2A22]">{fmtEs(foliarProductPerHa)} L/ha</dd>
              </div>
            )}
            {activeVia === 'pulverizador' && product.methods.pulverizador?.applicationsPerCycle && (
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Aplicaciones por ciclo</dt>
                <dd className="font-medium text-[#0F2A22]">{product.methods.pulverizador.applicationsPerCycle.min}–{product.methods.pulverizador.applicationsPerCycle.max}</dd>
              </div>
            )}
          </dl>

          {(outOfLabel || caldoOut) && (
            <p className="mt-3 rounded-lg border border-terra-200 bg-terra-50 px-3 py-2 text-xs font-medium text-terra-700">
              {outOfLabel ? `${activeVia === 'foliar' ? 'Concentración' : 'Dosis'} fuera del rango de etiqueta (${rangeText}). ` : ''}
              {caldoOut ? `Caldo fuera del rango de etiqueta (${dronWater!.min}–${dronWater!.max} L/ha). ` : ''}
              Consulte a su técnico.
            </p>
          )}
        </ResultPanel>
        <NoteList notes={product.applicationNotes} source={product.source} />
      </div>
    </div>
  );
}

// ── Modo PRODUCTO SIN ETIQUETA (dosis libre, sin inventar rango) ─────────────
function LabelPendingMode({ product, areaStr, setAreaStr }: { product: ProductSpec; areaStr: string; setAreaStr: (v: string) => void }) {
  const [doseStr, setDoseStr] = useState('');
  const [unit, setUnit] = useState<ApplicationUnit>('L/ha');
  const dose = parseFloat(doseStr);
  const area = parseFloat(areaStr);
  const hasDose = Number.isFinite(dose) && dose > 0;
  const hasArea = Number.isFinite(area) && area > 0;
  return (
    <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.05fr]">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 content-start">
        <Field label="Dosis / ha">
          <input type="number" step="any" min="0" value={doseStr} onChange={(e) => setDoseStr(e.target.value)} className={inputCls()} />
        </Field>
        <Field label="Unidad">
          <select value={unit} onChange={(e) => setUnit(e.target.value as ApplicationUnit)} className={selectCls}>
            {APPLICATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Superficie (ha)">
          <input type="number" step="any" min="0" value={areaStr} onChange={(e) => setAreaStr(e.target.value)} className={inputCls()} />
        </Field>
      </div>
      <div className="flex flex-col gap-3">
        <ResultPanel eyebrow={hasArea ? `Cargar para ${fmtEs(area)} ha` : 'Cargar'}>
          {hasDose && hasArea
            ? (() => { const t = fmtTotal(dose * area, unit); return <HeroStat n={t.n} u={t.u} label="producto" />; })()
            : <HeroStat n="—" u="" label="producto" tone="ink" />}
          <p className="mt-3 border-t border-earth-300/40 pt-3 text-[11px] leading-relaxed text-gray-500">
            Etiqueta aún no cargada — sin rango de referencia; la dosis la fija el técnico.
          </p>
        </ResultPanel>
        <NoteList source={product.source + (product.manufacturer ? ` · ${product.manufacturer}` : '')} />
      </div>
    </div>
  );
}

// ── Identidad del producto / mezcla ──────────────────────────────────────────
function Identity({ title, kind, stamps }: { title: string; kind?: string; stamps?: string[] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 className="font-display text-2xl leading-tight text-[#0F2A22]">{title}</h3>
      {stamps?.map((s) => <Stamp key={s}>{s}</Stamp>)}
      {kind && <p className="w-full text-[11px] leading-snug text-gray-500">{kind}</p>}
    </div>
  );
}

export default function DoseCalculatorCard({ defaultAreaHa }: Props) {
  const [selection, setSelection] = useState(TANK_MIXES[0] ? `mix:${TANK_MIXES[0].id}` : `prod:${PRODUCT_CATALOG[0]?.id}`);
  const [areaStr, setAreaStr] = useState(defaultAreaHa ? String(defaultAreaHa) : '');

  const mix = selection.startsWith('mix:') ? TANK_MIXES.find((m) => `mix:${m.id}` === selection) : undefined;
  const product = selection.startsWith('prod:') ? PRODUCT_CATALOG.find((p) => `prod:${p.id}` === selection) : undefined;

  return (
    <div className="overflow-hidden rounded-2xl border border-earth-300/50 bg-[#FBF8F2] shadow-sm">
      {/* Cabecera */}
      <div className="flex flex-col gap-3 border-b border-earth-300/40 bg-white/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2.5">
          <img src="/service-fertilization.svg" alt="" className="h-8 w-8 flex-shrink-0" />
          <Eyebrow>Ficha de carga · dosis de etiqueta</Eyebrow>
        </div>
        <div className="w-full sm:w-80">
          <select value={selection} onChange={(e) => setSelection(e.target.value)} className={selectCls} aria-label="Qué preparas">
            {TANK_MIXES.length > 0 && (
              <optgroup label="Mezclas de tanque">
                {TANK_MIXES.map((m) => <option key={m.id} value={`mix:${m.id}`}>{m.name}</option>)}
              </optgroup>
            )}
            <optgroup label="Productos sueltos">
              {PRODUCT_CATALOG.map((p) => <option key={p.id} value={`prod:${p.id}`}>{p.name}</option>)}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        {mix && (
          <>
            <Identity title={mix.name} kind="Mezcla de tanque · orden de carga en la cuba" />
            <TankMixMode key={mix.id} mix={mix} areaStr={areaStr} setAreaStr={setAreaStr} />
          </>
        )}
        {product && (
          <>
            <Identity
              title={product.name}
              kind={product.kind}
              stamps={product.labelPending ? ['etiqueta pendiente'] : product.certifications?.slice(0, 1).map((c) => c.split('·')[0].trim())}
            />
            {product.labelPending
              ? <LabelPendingMode key={product.id} product={product} areaStr={areaStr} setAreaStr={setAreaStr} />
              : <SingleProductMode key={product.id} product={product} areaStr={areaStr} setAreaStr={setAreaStr} />}
          </>
        )}
      </div>
    </div>
  );
}
