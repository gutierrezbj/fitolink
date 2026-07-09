import { useState } from 'react';
import {
  PRODUCT_CATALOG,
  TANK_MIXES,
  labelRangeText,
  type ProductSpec,
  type TankMixSpec,
} from '@fitolink/shared';

/**
 * Calculadora de mezcla según ETIQUETA del fabricante · 08-jul-2026.
 * 09-jul: vías foliar-% y riego (Microbiota 108).
 * 10-jul: MEZCLA DE TANQUE — los productos que se preparan juntos en la misma
 *         cuba, como receta de carga en orden (agua → Love Green → Microbiota).
 *
 * Los rangos salen de packages/shared/productCatalog.ts (transcripción literal
 * de cada etiqueta); fuera de rango se avisa — la decisión es del técnico.
 * Solo DATO: sin narrativa (regla producto ≠ speech).
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
    warn ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
  }`;

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

  // Rango de caldo: si algún componente trae volumen de agua de etiqueta (dron).
  const waterRange = comps.map((c) => c.spec.methods.dron?.waterLPerHa).find(Boolean);
  const caldoOut = hasCaldo && waterRange ? caldo < waterRange.min || caldo > waterRange.max : false;

  // Por componente: dosis, chequeo contra SU etiqueta (por-ha o % del caldo).
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
    return { ...c, dose, hasDose, out, rangeText, pctEquiv, pctRange: pct };
  });

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
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
        </div>
        {rows.map((r) => (
          <div key={r.productId}>
            <label className="block text-xs text-gray-500 mb-1 truncate" title={r.spec.name}>
              {r.spec.name.split('·')[0].trim()} ({r.unit})
            </label>
            <input
              type="number" step="any" min="0" value={doseStrs[r.productId] ?? ''}
              onChange={(e) => setDoseStrs((m) => ({ ...m, [r.productId]: e.target.value }))}
              placeholder={r.rangeText}
              className={inputCls(r.out)}
            />
          </div>
        ))}
      </div>

      {/* Receta de carga — en orden de incorporación a la cuba */}
      <div className="mt-3 border-t border-gray-100 pt-2.5">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Receta de carga{hasArea ? ` · ${fmtEs(area)} ha` : ''}
        </p>
        <ol className="space-y-1 text-sm">
          <li className="flex justify-between gap-2">
            <span className="text-gray-500">1 · Agua{caldoOut && waterRange ? ` (etiqueta ${waterRange.min}–${waterRange.max} L/ha)` : ''}</span>
            <span className={`font-medium ${caldoOut ? 'text-amber-700' : 'text-gray-900'}`}>
              {hasArea && hasCaldo ? fmtTotal(caldo * area, 'L/ha') : '—'}
            </span>
          </li>
          {rows.map((r, i) => (
            <li key={r.productId}>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">
                  {i + 2} · {r.spec.name.split('·')[0].trim()}
                  {r.pctEquiv != null && r.pctRange ? ` (≈${fmtEs(r.pctEquiv, 1)}% del caldo · etiqueta ${r.pctRange.min}–${r.pctRange.max}%)` : ''}
                </span>
                <span className={`font-bold ${r.out ? 'text-amber-700' : 'text-brand-700'}`}>
                  {hasArea && r.hasDose ? fmtTotal(r.dose * area, r.unit) : '—'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">{r.stepNote}</p>
            </li>
          ))}
        </ol>
      </div>

      {rows.some((r) => r.out) || caldoOut ? (
        <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Hay valores fuera del rango de etiqueta. Consulte a su técnico.
        </p>
      ) : null}

      {mix.notes?.map((n) => (
        <p key={n} className="mt-2 text-[11px] leading-relaxed text-gray-500">· {n}</p>
      ))}
      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{mix.source}</p>
    </>
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
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Vía</label>
          <select
            value={activeVia}
            onChange={(e) => { setVia(e.target.value as Via); setDoseStr(''); setCaldoStr(''); }}
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            {vias.map((v) => (
              <option key={v} value={v}>{VIA_LABEL[v]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            {activeVia === 'foliar' ? 'Concentración (%)' : `Dosis ${perHa ? `(${perHa.unit})` : ''}`}
          </label>
          <input type="number" step="any" min="0" value={doseStr} onChange={(e) => setDoseStr(e.target.value)} placeholder={rangeText} className={inputCls(outOfLabel)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Superficie (ha)</label>
          <input type="number" step="any" min="0" value={areaStr} onChange={(e) => setAreaStr(e.target.value)} className={inputCls(false)} />
        </div>
        {activeVia === 'foliar' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Caldo (L/ha)</label>
            <input type="number" step="any" min="0" value={caldoStr} onChange={(e) => setCaldoStr(e.target.value)} placeholder="p.ej. 100" className={inputCls(false)} />
          </div>
        )}
      </div>

      <dl className="mt-3 space-y-1 text-sm border-t border-gray-100 pt-2.5">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Etiqueta ({VIA_LABEL[activeVia].toLowerCase()})</dt>
          <dd className="font-medium text-gray-900">{rangeText || '—'}</dd>
        </div>
        {activeVia === 'dron' && product.methods.dron && (
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Caldo (agua) etiqueta</dt>
            <dd className="font-medium text-gray-900">
              {product.methods.dron.waterLPerHa.min}–{product.methods.dron.waterLPerHa.max} L/ha
            </dd>
          </div>
        )}
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
            <dt className="text-gray-500">Producto total · {fmtEs(area)} ha</dt>
            <dd className={`font-bold ${outOfLabel ? 'text-amber-700' : 'text-brand-700'}`}>
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
        <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {activeVia === 'foliar' ? 'Concentración' : 'Dosis'} fuera del rango de etiqueta ({rangeText}). Consulte a su técnico.
        </p>
      )}

      {product.applicationNotes?.map((n) => (
        <p key={n} className="mt-2 text-[11px] leading-relaxed text-gray-500">· {n}</p>
      ))}
      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
        {product.source} · {product.kind}
        {product.certifications?.length ? ` · ${product.certifications[0]}` : ''}
      </p>
    </>
  );
}

export default function DoseCalculatorCard({ defaultAreaHa }: Props) {
  // Por defecto la MEZCLA (es lo que se aplica en el campo); productos sueltos detrás.
  const [selection, setSelection] = useState(TANK_MIXES[0] ? `mix:${TANK_MIXES[0].id}` : `prod:${PRODUCT_CATALOG[0]?.id}`);
  const [areaStr, setAreaStr] = useState(defaultAreaHa ? String(defaultAreaHa) : '');

  const mix = selection.startsWith('mix:') ? TANK_MIXES.find((m) => `mix:${m.id}` === selection) : undefined;
  const product = selection.startsWith('prod:') ? PRODUCT_CATALOG.find((p) => `prod:${p.id}` === selection) : undefined;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Mezcla · dosis de etiqueta
      </h2>

      <div className="max-w-md">
        <label className="block text-xs text-gray-500 mb-1">Qué preparas</label>
        <select
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
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

      {mix && <TankMixMode key={mix.id} mix={mix} areaStr={areaStr} setAreaStr={setAreaStr} />}
      {product && <SingleProductMode key={product.id} product={product} areaStr={areaStr} setAreaStr={setAreaStr} />}
    </div>
  );
}
