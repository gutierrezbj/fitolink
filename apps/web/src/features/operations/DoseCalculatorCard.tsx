import { useState } from 'react';
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
 * Calculadora de mezcla según ETIQUETA del fabricante · 08-jul-2026.
 * 09-jul: vías foliar-% y riego (Microbiota 108).
 * 10-jul: MEZCLA DE TANQUE (receta de carga en orden) + rediseño editorial
 *         AgroM: barra mín–máx de etiqueta con el marcador de la dosis
 *         (espejo de la tabla DOSIS MÍN./MÁX. del envase), receta en panel
 *         pergamino, numeración en círculos brand (line-icon language).
 *
 * Los rangos salen de packages/shared/productCatalog.ts (transcripción literal
 * de cada etiqueta); fuera de rango se marca en terra — la decisión es del
 * técnico. Solo DATO: sin narrativa (regla producto ≠ speech).
 */

type Via = 'dron' | 'pulverizador' | 'foliar' | 'riego';

const VIA_LABEL: Record<Via, string> = {
  dron: 'Dron',
  pulverizador: 'Pulverizador / atomizador',
  foliar: 'Foliar (% en agua)',
  riego: 'Riego (fertirrigación)',
};

function availableVias(p: ProductSpec): Via[] {
  return (Object.keys(VIA_LABEL) as Via[]).filter((v) => p.methods[v]);
}

// Total legible: g→kg y mL→L cuando el acumulado pasa de 1000.
function fmtTotal(total: number, unitPerHa: string): string {
  const base = unitPerHa.split('/')[0];
  const f = (n: number, d: number) => n.toLocaleString('es-ES', { maximumFractionDigits: d });
  if (base === 'g') return total >= 1000 ? `${f(total / 1000, 2)} kg` : `${f(total, 1)} g`;
  if (base === 'mL') return total >= 1000 ? `${f(total / 1000, 2)} L` : `${f(total, 1)} mL`;
  return `${f(total, 2)} ${base}`;
}

const fmtEs = (n: number, d = 2) => n.toLocaleString('es-ES', { maximumFractionDigits: d });

const inputCls = (warn: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
    warn ? 'border-terra-400 bg-terra-50 text-terra-800' : 'border-earth-200'
  }`;

const selectCls =
  'w-full border border-earth-200 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500';

/**
 * Barra mín–máx de etiqueta con el marcador de la dosis elegida — la tabla
 * "DOSIS MÍN./HA · DOSIS MÁX./HA" del envase hecha visual. Marcador brand
 * dentro de rango, terra fuera (clavado al borde).
 */
function RangeBar({ min, max, value, unit }: { min: number; max: number; value?: number | null; unit: string }) {
  const has = value != null && Number.isFinite(value) && value > 0;
  const raw = has ? (value! - min) / (max - min) : null;
  const pos = raw != null ? Math.max(0, Math.min(1, raw)) : null;
  const out = raw != null && (raw < 0 || raw > 1);
  return (
    <div className="mt-1.5 px-0.5">
      <div className="relative h-1 rounded-full bg-earth-100">
        <div className="absolute inset-y-0 left-0 rounded-full bg-brand-200" style={{ width: pos != null && !out ? `${pos * 100}%` : 0 }} />
        {pos != null && (
          <span
            className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${out ? 'bg-terra-500' : 'bg-brand-600'}`}
            style={{ left: `calc(${pos * 100}% - 5px)` }}
          />
        )}
      </div>
      <div className="flex justify-between mt-1 text-[10px] leading-none text-gray-400">
        <span>mín {fmtEs(min)} {unit}</span>
        <span>máx {fmtEs(max)} {unit}</span>
      </div>
    </div>
  );
}

/** Círculo numerado del paso de carga — mismo lenguaje que el set line-icon. */
function StepBadge({ n }: { n: number }) {
  return (
    <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
      {n}
    </span>
  );
}

interface Props {
  /** Hectáreas iniciales (área de la parcela / del trabajo). */
  defaultAreaHa?: number;
}

// ── Modo MEZCLA DE TANQUE ────────────────────────────────────────────────────
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
    const rangeText = perHa ? labelRangeText(perHa) : pct ? `${pct.min}–${pct.max} % del caldo` : '';
    const shortName = c.spec.name.split('·')[0].trim();
    return { ...c, dose, hasDose, out, rangeText, pctEquiv, pctRange: pct, perHa, shortName };
  });

  const anyOut = rows.some((r) => r.out) || caldoOut;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      {/* Entradas — cada dosis con su barra mín–máx de etiqueta */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 content-start">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Superficie (ha)</label>
          <input type="number" step="any" min="0" value={areaStr} onChange={(e) => setAreaStr(e.target.value)} className={inputCls(false)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Caldo (agua · L/ha)</label>
          <input
            type="number" step="any" min="0" value={caldoStr}
            onChange={(e) => setCaldoStr(e.target.value)}
            placeholder={waterRange ? `${waterRange.min}–${waterRange.max}` : ''}
            className={inputCls(caldoOut)}
          />
          {waterRange && <RangeBar min={waterRange.min} max={waterRange.max} value={hasCaldo ? caldo : null} unit="L/ha" />}
        </div>
        {rows.map((r) => (
          <div key={r.productId}>
            <label className="block text-xs text-gray-500 mb-1 truncate" title={r.spec.name}>
              {r.shortName} ({r.unit})
            </label>
            <input
              type="number" step="any" min="0" value={doseStrs[r.productId] ?? ''}
              onChange={(e) => setDoseStrs((m) => ({ ...m, [r.productId]: e.target.value }))}
              placeholder={r.rangeText}
              className={inputCls(r.out)}
            />
            {r.perHa && <RangeBar min={r.perHa.min} max={r.perHa.max} value={r.hasDose ? r.dose : null} unit={r.perHa.unit} />}
            {!r.perHa && r.pctRange && (
              <RangeBar min={r.pctRange.min} max={r.pctRange.max} value={r.pctEquiv} unit="% del caldo" />
            )}
          </div>
        ))}
      </div>

      {/* Receta de carga — panel pergamino, en orden de incorporación */}
      <div className="bg-earth-50/70 border border-earth-200/60 rounded-lg p-4">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
          Receta de carga{hasArea ? ` · ${fmtEs(area)} ha` : ''}
        </p>
        <ol className="space-y-2.5">
          <li className="flex gap-2.5">
            <StepBadge n={1} />
            <div className="flex-1 flex justify-between gap-2">
              <span className="text-sm text-gray-700">Agua</span>
              <span className={`text-sm font-bold ${caldoOut ? 'text-terra-600' : 'text-brand-800'}`}>
                {hasArea && hasCaldo ? fmtTotal(caldo * area, 'L/ha') : '—'}
              </span>
            </div>
          </li>
          {rows.map((r, i) => (
            <li key={r.productId} className="flex gap-2.5">
              <StepBadge n={i + 2} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <span className="text-sm text-gray-700">
                    {r.shortName}
                    {r.pctEquiv != null && r.pctRange && (
                      <span className={`ml-1 text-[11px] ${r.out ? 'text-terra-600 font-medium' : 'text-gray-400'}`}>
                        ≈{fmtEs(r.pctEquiv, 1)}% del caldo
                      </span>
                    )}
                  </span>
                  <span className={`text-sm font-bold ${r.out ? 'text-terra-600' : 'text-brand-800'}`}>
                    {hasArea && r.hasDose ? fmtTotal(r.dose * area, r.unit) : '—'}
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-gray-500 mt-0.5">{r.stepNote}</p>
              </div>
            </li>
          ))}
        </ol>

        {anyOut && (
          <p className="mt-3 text-xs font-medium text-terra-700 bg-terra-50 border border-terra-200 rounded-lg px-3 py-2">
            Hay valores fuera del rango de etiqueta. Consulte a su técnico.
          </p>
        )}

        {mix.notes && mix.notes.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-earth-200/60 space-y-1">
            {mix.notes.map((n) => (
              <p key={n} className="text-[11px] leading-relaxed text-gray-500">· {n}</p>
            ))}
          </div>
        )}
      </div>

      <p className="lg:col-span-2 text-[11px] leading-relaxed text-gray-400">{mix.source}</p>
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
  const outOfLabel = hasDose
    ? perHa ? dose < perHa.min || dose > perHa.max
      : pct ? dose < pct.min || dose > pct.max
      : false
    : false;

  const foliarProductPerHa = activeVia === 'foliar' && hasDose && hasCaldo ? (caldo * dose) / 100 : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      {/* Entradas */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 content-start">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Vía</label>
          <select
            value={activeVia}
            onChange={(e) => { setVia(e.target.value as Via); setDoseStr(''); setCaldoStr(''); }}
            className={selectCls}
          >
            {vias.map((v) => (
              <option key={v} value={v}>{VIA_LABEL[v]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Superficie (ha)</label>
          <input type="number" step="any" min="0" value={areaStr} onChange={(e) => setAreaStr(e.target.value)} className={inputCls(false)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            {activeVia === 'foliar' ? 'Concentración (%)' : `Dosis ${perHa ? `(${perHa.unit})` : ''}`}
          </label>
          <input type="number" step="any" min="0" value={doseStr} onChange={(e) => setDoseStr(e.target.value)} placeholder={rangeText} className={inputCls(outOfLabel)} />
          {perHa && <RangeBar min={perHa.min} max={perHa.max} value={hasDose ? dose : null} unit={perHa.unit} />}
          {pct && <RangeBar min={pct.min} max={pct.max} value={hasDose ? dose : null} unit="%" />}
        </div>
        {activeVia === 'foliar' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Caldo (L/ha)</label>
            <input type="number" step="any" min="0" value={caldoStr} onChange={(e) => setCaldoStr(e.target.value)} placeholder="p.ej. 100" className={inputCls(false)} />
          </div>
        )}
        {activeVia === 'dron' && product.methods.dron && (
          <div className="col-span-2 text-[11px] text-gray-500">
            Caldo (agua) de etiqueta: {product.methods.dron.waterLPerHa.min}–{product.methods.dron.waterLPerHa.max} L/ha
          </div>
        )}
      </div>

      {/* Totales — panel pergamino */}
      <div className="bg-earth-50/70 border border-earth-200/60 rounded-lg p-4">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
          Totales{hasArea ? ` · ${fmtEs(area)} ha` : ''}
        </p>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Etiqueta ({VIA_LABEL[activeVia].toLowerCase()})</dt>
            <dd className="font-medium text-gray-900">{rangeText || '—'}</dd>
          </div>
          {activeVia === 'pulverizador' && product.methods.pulverizador?.applicationsPerCycle && (
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Aplicaciones por ciclo</dt>
              <dd className="font-medium text-gray-900">
                {product.methods.pulverizador.applicationsPerCycle.min}–{product.methods.pulverizador.applicationsPerCycle.max} según cultivo
              </dd>
            </div>
          )}
          {foliarProductPerHa != null && (
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Producto por ha ({dose}% de {fmtEs(caldo)} L)</dt>
              <dd className="font-medium text-gray-900">{fmtEs(foliarProductPerHa)} L/ha</dd>
            </div>
          )}
          {hasArea && (activeVia === 'foliar' ? foliarProductPerHa != null : hasDose && perHa) && (
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Producto total</dt>
              <dd className={`font-bold ${outOfLabel ? 'text-terra-600' : 'text-brand-800'}`}>
                {activeVia === 'foliar'
                  ? `${fmtEs(foliarProductPerHa! * area)} L`
                  : fmtTotal(dose * area, perHa!.unit)}
              </dd>
            </div>
          )}
          {hasArea && activeVia === 'dron' && product.methods.dron && (
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Agua total</dt>
              <dd className="font-medium text-gray-900">
                {fmtTotal(product.methods.dron.waterLPerHa.min * area, 'L/ha')} – {fmtTotal(product.methods.dron.waterLPerHa.max * area, 'L/ha')}
              </dd>
            </div>
          )}
          {hasArea && hasCaldo && activeVia === 'foliar' && (
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Caldo total</dt>
              <dd className="font-medium text-gray-900">{fmtTotal(caldo * area, 'L/ha')}</dd>
            </div>
          )}
        </dl>

        {outOfLabel && (
          <p className="mt-3 text-xs font-medium text-terra-700 bg-terra-50 border border-terra-200 rounded-lg px-3 py-2">
            {activeVia === 'foliar' ? 'Concentración' : 'Dosis'} fuera del rango de etiqueta ({rangeText}). Consulte a su técnico.
          </p>
        )}

        {product.applicationNotes && product.applicationNotes.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-earth-200/60 space-y-1">
            {product.applicationNotes.map((n) => (
              <p key={n} className="text-[11px] leading-relaxed text-gray-500">· {n}</p>
            ))}
          </div>
        )}
      </div>

      <p className="lg:col-span-2 text-[11px] leading-relaxed text-gray-400">
        {product.source} · {product.kind}
        {product.certifications?.length ? ` · ${product.certifications[0]}` : ''}
      </p>
    </div>
  );
}

// ── Modo PRODUCTO SIN ETIQUETA CARGADA ───────────────────────────────────────
// Dosis libre (a criterio del técnico) — no inventamos rango. Solo el total.
function LabelPendingMode({ product, areaStr, setAreaStr }: { product: ProductSpec; areaStr: string; setAreaStr: (v: string) => void }) {
  const [doseStr, setDoseStr] = useState('');
  const [unit, setUnit] = useState<ApplicationUnit>('L/ha');
  const dose = parseFloat(doseStr);
  const area = parseFloat(areaStr);
  const hasDose = Number.isFinite(dose) && dose > 0;
  const hasArea = Number.isFinite(area) && area > 0;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 content-start">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Dosis / ha</label>
          <input type="number" step="any" min="0" value={doseStr} onChange={(e) => setDoseStr(e.target.value)} className={inputCls(false)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Unidad</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value as ApplicationUnit)} className={selectCls}>
            {APPLICATION_UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Superficie (ha)</label>
          <input type="number" step="any" min="0" value={areaStr} onChange={(e) => setAreaStr(e.target.value)} className={inputCls(false)} />
        </div>
      </div>
      <div className="bg-earth-50/70 border border-earth-200/60 rounded-lg p-4">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
          Totales{hasArea ? ` · ${fmtEs(area)} ha` : ''}
        </p>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Etiqueta</dt>
            <dd className="font-medium text-gray-500">pendiente de cargar</dd>
          </div>
          {hasDose && hasArea && (
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Producto total</dt>
              <dd className="font-bold text-brand-800">{fmtTotal(dose * area, unit)}</dd>
            </div>
          )}
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
          Etiqueta aún no cargada — sin rango de referencia; la dosis la fija el técnico.
        </p>
      </div>
      <p className="lg:col-span-2 text-[11px] leading-relaxed text-gray-400">
        {product.source}{product.manufacturer ? ` · ${product.manufacturer}` : ''}
      </p>
    </div>
  );
}

export default function DoseCalculatorCard({ defaultAreaHa }: Props) {
  // Por defecto la MEZCLA (es lo que se aplica en el campo); productos sueltos detrás.
  const [selection, setSelection] = useState(TANK_MIXES[0] ? `mix:${TANK_MIXES[0].id}` : `prod:${PRODUCT_CATALOG[0]?.id}`);
  const [areaStr, setAreaStr] = useState(defaultAreaHa ? String(defaultAreaHa) : '');

  const mix = selection.startsWith('mix:') ? TANK_MIXES.find((m) => `mix:${m.id}` === selection) : undefined;
  const product = selection.startsWith('prod:') ? PRODUCT_CATALOG.find((p) => `prod:${p.id}` === selection) : undefined;

  return (
    <div className="bg-white rounded-xl border border-earth-300/40 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/service-fertilization.svg" alt="" className="w-8 h-8 flex-shrink-0" />
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Mezcla · dosis de etiqueta
          </h2>
        </div>
        <div className="w-full sm:w-80">
          <select value={selection} onChange={(e) => setSelection(e.target.value)} className={selectCls} aria-label="Qué preparas">
            {TANK_MIXES.length > 0 && (
              <optgroup label="Mezclas de tanque">
                {TANK_MIXES.map((m) => (
                  <option key={m.id} value={`mix:${m.id}`}>{m.name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Productos sueltos">
              {PRODUCT_CATALOG.map((p) => (
                <option key={p.id} value={`prod:${p.id}`}>{p.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {mix && <TankMixMode key={mix.id} mix={mix} areaStr={areaStr} setAreaStr={setAreaStr} />}
      {product && product.labelPending && <LabelPendingMode key={product.id} product={product} areaStr={areaStr} setAreaStr={setAreaStr} />}
      {product && !product.labelPending && <SingleProductMode key={product.id} product={product} areaStr={areaStr} setAreaStr={setAreaStr} />}
    </div>
  );
}
