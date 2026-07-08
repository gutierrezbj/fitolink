import { useState } from 'react';
import { PRODUCT_CATALOG, labelRangeText, type ProductSpec } from '@fitolink/shared';

/**
 * Calculadora de mezcla según ETIQUETA del fabricante · 08-jul-2026.
 *
 * Producto (catálogo) + dosis elegida + hectáreas → total de producto y rango
 * de agua (caldo) del trabajo. Los rangos salen de packages/shared/
 * productCatalog.ts (transcripción literal de la etiqueta); si la dosis
 * elegida se sale del rango, se marca — la decisión final es del técnico.
 * Solo DATO: sin narrativa (regla producto ≠ speech).
 */

// Total legible: g→kg y mL→L cuando el acumulado pasa de 1000.
function fmtTotal(total: number, unitPerHa: string): string {
  const base = unitPerHa.split('/')[0];
  const f = (n: number, d: number) => n.toLocaleString('es-ES', { maximumFractionDigits: d });
  if (base === 'g') return total >= 1000 ? `${f(total / 1000, 2)} kg` : `${f(total, 1)} g`;
  if (base === 'mL') return total >= 1000 ? `${f(total / 1000, 2)} L` : `${f(total, 1)} mL`;
  return `${f(total, 2)} ${base}`;
}

interface Props {
  /** Hectáreas iniciales (área de la parcela / del trabajo). */
  defaultAreaHa?: number;
}

export default function DoseCalculatorCard({ defaultAreaHa }: Props) {
  const [productId, setProductId] = useState(PRODUCT_CATALOG[0]?.id ?? '');
  const [via, setVia] = useState<'dron' | 'pulverizador'>('dron');
  const [doseStr, setDoseStr] = useState('');
  const [areaStr, setAreaStr] = useState(defaultAreaHa ? String(defaultAreaHa) : '');

  const product: ProductSpec | undefined = PRODUCT_CATALOG.find((p) => p.id === productId);
  if (!product) return null;

  const method = via === 'dron' ? product.methods.dron : product.methods.pulverizador;
  const dose = parseFloat(doseStr);
  const area = parseFloat(areaStr);
  const hasDose = Number.isFinite(dose) && dose > 0;
  const hasArea = Number.isFinite(area) && area > 0;
  const outOfLabel = hasDose && method ? dose < method.dose.min || dose > method.dose.max : false;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Mezcla · dosis de etiqueta
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Producto</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
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
            value={via}
            onChange={(e) => setVia(e.target.value as 'dron' | 'pulverizador')}
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            {product.methods.dron && <option value="dron">Dron</option>}
            {product.methods.pulverizador && <option value="pulverizador">Pulverizador / atomizador</option>}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Dosis {method ? `(${method.dose.unit})` : ''}
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={doseStr}
            onChange={(e) => setDoseStr(e.target.value)}
            placeholder={method ? labelRangeText(method.dose) : ''}
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
      </div>

      {method && (
        <dl className="mt-3 space-y-1 text-sm border-t border-gray-100 pt-2.5">
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Etiqueta ({via === 'dron' ? 'dron' : 'pulverizador'})</dt>
            <dd className="font-medium text-gray-900">{labelRangeText(method.dose)}</dd>
          </div>
          {via === 'dron' && product.methods.dron && (
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Caldo (agua) etiqueta</dt>
              <dd className="font-medium text-gray-900">
                {product.methods.dron.waterLPerHa.min}–{product.methods.dron.waterLPerHa.max} L/ha
              </dd>
            </div>
          )}
          {via === 'pulverizador' && product.methods.pulverizador?.applicationsPerCycle && (
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Aplicaciones por ciclo</dt>
              <dd className="font-medium text-gray-900">
                {product.methods.pulverizador.applicationsPerCycle.min}–{product.methods.pulverizador.applicationsPerCycle.max} según cultivo
              </dd>
            </div>
          )}
          {hasDose && hasArea && (
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Producto total · {area.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ha</dt>
              <dd className={`font-bold ${outOfLabel ? 'text-amber-700' : 'text-brand-700'}`}>
                {fmtTotal(dose * area, method.dose.unit)}
              </dd>
            </div>
          )}
          {hasArea && via === 'dron' && product.methods.dron && (
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Agua total</dt>
              <dd className="font-medium text-gray-900">
                {fmtTotal(product.methods.dron.waterLPerHa.min * area, 'L/ha')} – {fmtTotal(product.methods.dron.waterLPerHa.max * area, 'L/ha')}
              </dd>
            </div>
          )}
        </dl>
      )}

      {outOfLabel && method && (
        <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Dosis fuera del rango de etiqueta ({labelRangeText(method.dose)}). Consulte a su técnico.
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
        {product.source} · {product.kind}
        {product.certifications?.length ? ` · ${product.certifications[0]}` : ''}
      </p>
    </div>
  );
}
