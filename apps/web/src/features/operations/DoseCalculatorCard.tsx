import { useState } from 'react';
import { PRODUCT_CATALOG, labelRangeText, type ProductSpec } from '@fitolink/shared';

/**
 * Calculadora de mezcla según ETIQUETA del fabricante · 08-jul-2026.
 * (09-jul: vías foliar-% y riego para productos tipo Biol — Microbiota 108.)
 *
 * Producto (catálogo) + vía + dosis + hectáreas → totales del trabajo. Los
 * rangos salen de packages/shared/productCatalog.ts (transcripción literal de
 * la etiqueta); fuera de rango se avisa — la decisión final es del técnico.
 * Vías soportadas:
 *   · dron / pulverizador / riego → dosis POR HECTÁREA
 *   · foliar → CONCENTRACIÓN (% del caldo) × volumen de caldo
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

interface Props {
  /** Hectáreas iniciales (área de la parcela / del trabajo). */
  defaultAreaHa?: number;
}

export default function DoseCalculatorCard({ defaultAreaHa }: Props) {
  const [productId, setProductId] = useState(PRODUCT_CATALOG[0]?.id ?? '');
  const [via, setVia] = useState<Via>(availableVias(PRODUCT_CATALOG[0]) [0] ?? 'dron');
  const [doseStr, setDoseStr] = useState('');
  const [caldoStr, setCaldoStr] = useState('');
  const [areaStr, setAreaStr] = useState(defaultAreaHa ? String(defaultAreaHa) : '');

  const product: ProductSpec | undefined = PRODUCT_CATALOG.find((p) => p.id === productId);
  if (!product) return null;

  const vias = availableVias(product);
  const activeVia: Via = vias.includes(via) ? via : vias[0];

  const dose = parseFloat(doseStr);
  const caldo = parseFloat(caldoStr);
  const area = parseFloat(areaStr);
  const hasDose = Number.isFinite(dose) && dose > 0;
  const hasCaldo = Number.isFinite(caldo) && caldo > 0;
  const hasArea = Number.isFinite(area) && area > 0;

  // Rango de etiqueta de la vía activa (por-ha o concentración).
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

  // Foliar: producto por ha = caldo (L/ha) × concentración.
  const foliarProductPerHa = activeVia === 'foliar' && hasDose && hasCaldo ? (caldo * dose) / 100 : null;

  const onSelectProduct = (id: string) => {
    setProductId(id);
    const p = PRODUCT_CATALOG.find((x) => x.id === id);
    if (p) {
      const vs = availableVias(p);
      if (!vs.includes(via)) setVia(vs[0]);
    }
    setDoseStr('');
    setCaldoStr('');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Mezcla · dosis de etiqueta
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Producto</label>
          <select
            value={productId}
            onChange={(e) => onSelectProduct(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            {PRODUCT_CATALOG.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
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
          <input
            type="number"
            step="any"
            min="0"
            value={doseStr}
            onChange={(e) => setDoseStr(e.target.value)}
            placeholder={rangeText}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
              outOfLabel ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
            }`}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Superficie (ha)</label>
          <input
            type="number"
            step="any"
            min="0"
            value={areaStr}
            onChange={(e) => setAreaStr(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        {activeVia === 'foliar' && (
          <div className="lg:col-start-4">
            <label className="block text-xs text-gray-500 mb-1">Caldo (L/ha)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={caldoStr}
              onChange={(e) => setCaldoStr(e.target.value)}
              placeholder="p.ej. 100"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
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
    </div>
  );
}
