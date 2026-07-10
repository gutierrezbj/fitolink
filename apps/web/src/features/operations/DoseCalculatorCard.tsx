import { useState, useRef, type ReactNode, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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
 * Calculadora de mezcla · "Ficha de carga" compacta (10-jul-2026).
 *
 * Herramienta de campo, no banner: una sola columna, tipografía de marca a
 * escala de calculadora, y deslizadores ARRASTRABLES (ratón/táctil/flechas)
 * para tantear dosis y caldo. La respuesta es la receta del depósito
 * (producto + agua) en cifras claras. Rangos = transcripción literal de la
 * etiqueta (productCatalog.ts). Se coloca junto al panel de informes en
 * OperationsPage. Solo DATO, cero narrativa.
 */

type Via = 'dron' | 'pulverizador' | 'foliar' | 'riego';

const VIA_LABEL: Record<Via, string> = {
  dron: 'Dron',
  pulverizador: 'Pulverizador',
  foliar: 'Foliar (% agua)',
  riego: 'Riego',
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

// Paso "bonito" (~100 pasos en el rango) para el deslizador.
function niceStep(range: number): number {
  if (range <= 0) return 1;
  const rough = range / 100;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const snap = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
  return snap * mag;
}

// ── Átomos visuales ──────────────────────────────────────────────────────────

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-earth-700/70">{children}</p>
);

const Stamp = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center rounded-full border border-earth-400/50 bg-earth-50 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-earth-700">
    {children}
  </span>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-gray-400">{label}</span>
    {children}
  </label>
);

const inputCls = (warn = false) =>
  `w-full rounded-lg border px-2.5 py-1.5 font-display text-base tabular-nums transition-colors focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 ${
    warn ? 'border-terra-400 bg-terra-50 text-terra-700' : 'border-earth-300/70 bg-white text-[#0F2A22]'
  }`;

const selectCls =
  'w-full rounded-lg border border-earth-300/70 bg-white px-2 py-1.5 text-sm focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500';

/** Deslizador de dosis — arrastrable con ratón/táctil/flechas. Espejo de la
 *  tabla DOSIS MÍN./MÁX. del envase, ahora como control. */
function Gauge({ min, max, value, unit, onChange }: { min: number; max: number; value?: number | null; unit: string; onChange?: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const has = value != null && Number.isFinite(value) && value > 0;
  const raw = has ? (value! - min) / (max - min) : null;
  const pos = raw != null ? Math.max(0, Math.min(1, raw)) : null;
  const out = raw != null && (raw < 0 || raw > 1);
  const interactive = !!onChange;
  const step = niceStep(max - min);

  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || !onChange) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const snapped = Math.round((min + ratio * (max - min)) / step) * step;
    onChange(Number(Math.max(min, Math.min(max, snapped)).toFixed(6)));
  };
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!interactive) return;
    e.preventDefault();
    dragging.current = true;
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    (e.currentTarget as HTMLElement).focus?.();
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: ReactPointerEvent) => { if (dragging.current) setFromClientX(e.clientX); };
  const endDrag = (e: ReactPointerEvent) => {
    dragging.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!interactive) return;
    const cur = has ? value! : min;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { onChange!(Number(Math.min(max, cur + step).toFixed(6))); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { onChange!(Number(Math.max(min, cur - step).toFixed(6))); e.preventDefault(); }
  };

  const thumbPos = pos ?? (interactive ? 0 : null);

  return (
    <div
      className={`select-none pt-1 ${interactive ? 'cursor-pointer touch-none' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role={interactive ? 'slider' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-valuemin={interactive ? min : undefined}
      aria-valuemax={interactive ? max : undefined}
      aria-valuenow={interactive && has ? value! : undefined}
      onKeyDown={onKeyDown}
    >
      <div className="relative py-1.5" ref={trackRef}>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-earth-100 shadow-[inset_0_1px_2px_rgba(83,59,22,0.18)]">
          <div className={`absolute inset-y-0 left-0 ${out ? 'bg-terra-300' : 'bg-brand-300'}`} style={{ width: pos != null ? `${pos * 100}%` : 0 }} />
          {[0.25, 0.5, 0.75].map((t) => (
            <span key={t} className="absolute top-1/2 h-1 w-px -translate-y-1/2 bg-earth-300" style={{ left: `${t * 100}%` }} />
          ))}
        </div>
        {interactive ? (
          <span
            className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-transform active:scale-110 ${out ? 'bg-terra-600' : 'bg-brand-600'} ${pos == null ? 'opacity-50' : ''}`}
            style={{ left: `${(thumbPos ?? 0) * 100}%` }}
          />
        ) : pos != null ? (
          <span className={`absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full ${out ? 'bg-terra-600' : 'bg-brand-700'}`} style={{ left: `${pos * 100}%` }} />
        ) : null}
      </div>
      <div className="flex justify-between font-mono text-[8px] uppercase tracking-wide text-gray-400">
        <span>{fmtEs(min)}</span>
        <span className="text-earth-700/60">{unit}</span>
        <span>{fmtEs(max)}</span>
      </div>
    </div>
  );
}

/** Cifra-héroe compacta: el número a cargar, en serif. */
function HeroStat({ n, u, label, tone = 'brand' }: { n: string; u: string; label: string; tone?: 'brand' | 'terra' | 'ink' }) {
  const color = tone === 'terra' ? 'text-terra-600' : tone === 'ink' ? 'text-[#0F2A22]' : 'text-brand-800';
  return (
    <div>
      <p className={`font-display leading-none tabular-nums ${color}`}>
        <span className="text-[1.6rem]">{n}</span>
        <span className="ml-0.5 text-sm text-gray-400">{u}</span>
      </p>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-gray-400">{label}</p>
    </div>
  );
}

const ResultPanel = ({ eyebrow, children }: { eyebrow: string; children: ReactNode }) => (
  <div className="rounded-lg border-l-2 border-terra-500 bg-earth-100/50 p-3">
    <Eyebrow>{eyebrow}</Eyebrow>
    <div className="mt-2">{children}</div>
  </div>
);

const StepBadge = ({ n }: { n: number }) => (
  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 font-mono text-[10px] font-bold text-white">{n}</span>
);

const NoteList = ({ notes, source }: { notes?: string[]; source?: string }) => (
  <div className="space-y-1 pt-1">
    {notes?.map((n) => <p key={n} className="text-[10px] leading-relaxed text-gray-500">· {n}</p>)}
    {source && <p className="text-[10px] leading-relaxed text-gray-400">{source}</p>}
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
    const out = hasDose ? (perHa ? dose < perHa.min || dose > perHa.max : pct && pctEquiv != null ? pctEquiv < pct.min || pctEquiv > pct.max : false) : false;
    return { ...c, dose, hasDose, out, perHa, pctRange: pct, pctEquiv, shortName: c.spec.name.split('·')[0].trim() };
  });
  const anyOut = rows.some((r) => r.out) || caldoOut;

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <Field label="Superficie (ha)">
          <input type="number" step="any" min="0" value={areaStr} onChange={(e) => setAreaStr(e.target.value)} className={inputCls()} />
        </Field>
        <Field label="Caldo · agua (L/ha)">
          <input type="number" step="any" min="0" value={caldoStr} onChange={(e) => setCaldoStr(e.target.value)} placeholder={waterRange ? `${waterRange.min}–${waterRange.max}` : ''} className={inputCls(caldoOut)} />
          {waterRange && <Gauge min={waterRange.min} max={waterRange.max} value={hasCaldo ? caldo : null} unit="L/ha" onChange={(v) => setCaldoStr(String(v))} />}
        </Field>
        {rows.map((r) => (
          <Field key={r.productId} label={`${r.shortName} (${r.unit})`}>
            <input type="number" step="any" min="0" value={doseStrs[r.productId] ?? ''} onChange={(e) => setDoseStrs((m) => ({ ...m, [r.productId]: e.target.value }))} placeholder={r.perHa ? labelRangeText(r.perHa) : ''} className={inputCls(r.out)} />
            {r.perHa && <Gauge min={r.perHa.min} max={r.perHa.max} value={r.hasDose ? r.dose : null} unit={r.perHa.unit} onChange={(v) => setDoseStrs((m) => ({ ...m, [r.productId]: String(v) }))} />}
            {!r.perHa && r.pctRange && <Gauge min={r.pctRange.min} max={r.pctRange.max} value={r.pctEquiv} unit="% caldo" />}
          </Field>
        ))}
      </div>

      <ResultPanel eyebrow={`Receta de carga${hasArea ? ` · ${fmtEs(area)} ha` : ''}`}>
        <ol className="space-y-2">
          <li className="flex items-start gap-2.5">
            <StepBadge n={1} />
            <div className="flex flex-1 items-baseline justify-between gap-2">
              <span className="text-xs text-gray-600">Agua</span>
              {hasArea && hasCaldo
                ? (() => { const r = fmtTotal(caldo * area, 'L/ha'); return <span className={`font-display text-xl leading-none tabular-nums ${caldoOut ? 'text-terra-600' : 'text-brand-800'}`}>{r.n}<span className="ml-0.5 text-xs text-gray-400">{r.u}</span></span>; })()
                : <span className="font-display text-xl text-gray-300">—</span>}
            </div>
          </li>
          {rows.map((r, i) => (
            <li key={r.productId} className="flex items-start gap-2.5">
              <StepBadge n={i + 2} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-gray-600">{r.shortName}</span>
                  {hasArea && r.hasDose
                    ? (() => { const t = fmtTotal(r.dose * area, r.unit); return <span className={`font-display text-xl leading-none tabular-nums ${r.out ? 'text-terra-600' : 'text-brand-800'}`}>{t.n}<span className="ml-0.5 text-xs text-gray-400">{t.u}</span></span>; })()
                    : <span className="font-display text-xl text-gray-300">—</span>}
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-gray-500">
                  {r.stepNote}
                  {r.pctEquiv != null && r.pctRange && <span className={r.out ? 'text-terra-600 font-medium' : 'text-gray-400'}> · ≈{fmtEs(r.pctEquiv, 1)}% del caldo</span>}
                </p>
              </div>
            </li>
          ))}
        </ol>
        {anyOut && <p className="mt-2 rounded-md border border-terra-200 bg-terra-50 px-2.5 py-1.5 text-[11px] font-medium text-terra-700">Valores fuera del rango de etiqueta. Consulte a su técnico.</p>}
      </ResultPanel>
      <NoteList notes={mix.notes} source={mix.source} />
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

  const dronWater = product.methods.dron?.waterLPerHa;
  const showCaldoInput = activeVia === 'foliar' || (activeVia === 'dron' && !!dronWater);
  const showWater = activeVia === 'dron' || activeVia === 'foliar';
  const caldoOut = activeVia === 'dron' && dronWater && hasCaldo ? caldo < dronWater.min || caldo > dronWater.max : false;
  const aguaTotal = hasArea && hasCaldo ? caldo * area : null;

  const productoStat = () => {
    if (activeVia === 'foliar') {
      if (foliarProductPerHa != null && hasArea) { const t = fmtTotal(foliarProductPerHa * area, 'L/ha'); return <HeroStat n={t.n} u={t.u} label="producto" tone={outOfLabel ? 'terra' : 'brand'} />; }
      return <HeroStat n="—" u="" label="producto" tone="ink" />;
    }
    if (hasDose && hasArea && perHa) { const t = fmtTotal(dose * area, perHa.unit); return <HeroStat n={t.n} u={t.u} label="producto" tone={outOfLabel ? 'terra' : 'brand'} />; }
    return <HeroStat n="—" u="" label="producto" tone="ink" />;
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
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
          {perHa && <Gauge min={perHa.min} max={perHa.max} value={hasDose ? dose : null} unit={perHa.unit} onChange={(v) => setDoseStr(String(v))} />}
          {pct && <Gauge min={pct.min} max={pct.max} value={hasDose ? dose : null} unit="%" onChange={(v) => setDoseStr(String(v))} />}
        </Field>
        {showCaldoInput && (
          <Field label="Caldo · agua (L/ha)">
            <input type="number" step="any" min="0" value={caldoStr} onChange={(e) => setCaldoStr(e.target.value)} placeholder={activeVia === 'dron' && dronWater ? `${dronWater.min}–${dronWater.max}` : 'p.ej. 100'} className={inputCls(caldoOut)} />
            {activeVia === 'dron' && dronWater && <Gauge min={dronWater.min} max={dronWater.max} value={hasCaldo ? caldo : null} unit="L/ha" onChange={(v) => setCaldoStr(String(v))} />}
          </Field>
        )}
      </div>

      <ResultPanel eyebrow={hasArea ? `Cargar en la cuba · ${fmtEs(area)} ha` : 'Cargar en la cuba'}>
        <div className="grid grid-cols-2 gap-3">
          {productoStat()}
          {showWater && (
            aguaTotal != null
              ? (() => { const t = fmtTotal(aguaTotal, 'L/ha'); return <HeroStat n={t.n} u={t.u} label="agua" tone={caldoOut ? 'terra' : 'ink'} />; })()
              : <HeroStat n="—" u="L" label={activeVia === 'dron' ? 'agua · pon caldo' : 'agua · pon caldo'} tone="ink" />
          )}
        </div>
        <div className="mt-2 border-t border-earth-300/40 pt-2 font-mono text-[10px] uppercase tracking-wide text-gray-400">
          etiqueta {VIA_LABEL[activeVia].toLowerCase()} · {rangeText || '—'}
          {activeVia === 'dron' && dronWater ? ` · caldo ${dronWater.min}–${dronWater.max} L/ha` : ''}
        </div>
        {(outOfLabel || caldoOut) && (
          <p className="mt-2 rounded-md border border-terra-200 bg-terra-50 px-2.5 py-1.5 text-[11px] font-medium text-terra-700">
            {outOfLabel ? `${activeVia === 'foliar' ? 'Concentración' : 'Dosis'} fuera de etiqueta. ` : ''}
            {caldoOut ? 'Caldo fuera de etiqueta. ' : ''}Consulte a su técnico.
          </p>
        )}
      </ResultPanel>
      <NoteList notes={product.applicationNotes} source={product.source} />
    </div>
  );
}

// ── Modo PRODUCTO SIN ETIQUETA (dosis libre) ─────────────────────────────────
function LabelPendingMode({ product, areaStr, setAreaStr }: { product: ProductSpec; areaStr: string; setAreaStr: (v: string) => void }) {
  const [doseStr, setDoseStr] = useState('');
  const [unit, setUnit] = useState<ApplicationUnit>('L/ha');
  const dose = parseFloat(doseStr);
  const area = parseFloat(areaStr);
  const hasDose = Number.isFinite(dose) && dose > 0;
  const hasArea = Number.isFinite(area) && area > 0;
  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-3 gap-x-3 gap-y-3">
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
      <ResultPanel eyebrow={hasArea ? `Cargar · ${fmtEs(area)} ha` : 'Cargar'}>
        {hasDose && hasArea
          ? (() => { const t = fmtTotal(dose * area, unit); return <HeroStat n={t.n} u={t.u} label="producto" />; })()
          : <HeroStat n="—" u="" label="producto" tone="ink" />}
        <p className="mt-2 border-t border-earth-300/40 pt-2 text-[10px] leading-relaxed text-gray-500">Etiqueta pendiente — la dosis la fija el técnico.</p>
      </ResultPanel>
      <NoteList source={product.source + (product.manufacturer ? ` · ${product.manufacturer}` : '')} />
    </div>
  );
}

const Identity = ({ title, stamps }: { title: string; stamps?: string[] }) => (
  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
    <h3 className="font-display text-lg leading-tight text-[#0F2A22]">{title}</h3>
    {stamps?.map((s) => <Stamp key={s}>{s}</Stamp>)}
  </div>
);

export default function DoseCalculatorCard({ defaultAreaHa }: Props) {
  const [selection, setSelection] = useState(TANK_MIXES[0] ? `mix:${TANK_MIXES[0].id}` : `prod:${PRODUCT_CATALOG[0]?.id}`);
  const [areaStr, setAreaStr] = useState(defaultAreaHa ? String(defaultAreaHa) : '');

  const mix = selection.startsWith('mix:') ? TANK_MIXES.find((m) => `mix:${m.id}` === selection) : undefined;
  const product = selection.startsWith('prod:') ? PRODUCT_CATALOG.find((p) => `prod:${p.id}` === selection) : undefined;

  return (
    <div className="h-full overflow-hidden rounded-xl border border-earth-300/50 bg-[#FBF8F2]">
      <div className="flex items-center gap-2 border-b border-earth-300/40 bg-white/40 px-4 py-2.5">
        <img src="/service-fertilization.svg" alt="" className="h-6 w-6 flex-shrink-0" />
        <Eyebrow>Calculadora · dosis de etiqueta</Eyebrow>
      </div>
      <div className="px-4 py-3.5">
        <select value={selection} onChange={(e) => setSelection(e.target.value)} className={`${selectCls} mb-3`} aria-label="Qué preparas">
          {TANK_MIXES.length > 0 && (
            <optgroup label="Mezclas de tanque">
              {TANK_MIXES.map((m) => <option key={m.id} value={`mix:${m.id}`}>{m.name}</option>)}
            </optgroup>
          )}
          <optgroup label="Productos sueltos">
            {PRODUCT_CATALOG.map((p) => <option key={p.id} value={`prod:${p.id}`}>{p.name}</option>)}
          </optgroup>
        </select>

        {mix && (
          <>
            <Identity title={mix.name} />
            <TankMixMode key={mix.id} mix={mix} areaStr={areaStr} setAreaStr={setAreaStr} />
          </>
        )}
        {product && (
          <>
            <Identity title={product.name} stamps={product.labelPending ? ['etiqueta pendiente'] : product.certifications?.slice(0, 1).map((c) => c.split('·')[0].trim())} />
            {product.labelPending
              ? <LabelPendingMode key={product.id} product={product} areaStr={areaStr} setAreaStr={setAreaStr} />
              : <SingleProductMode key={product.id} product={product} areaStr={areaStr} setAreaStr={setAreaStr} />}
          </>
        )}
      </div>
    </div>
  );
}
