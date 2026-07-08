import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { APPLICATION_UNITS, PRODUCT_CATALOG, findCatalogProduct, labelRangeText } from '@fitolink/shared';
import { api } from '@/lib/api.js';
import { toast } from '@/stores/toastStore.js';

interface Props {
  operationId: string;
  parcelName: string;
  areaHa?: number;
  onCancel: () => void;
  onComplete: () => void;
}

export default function CompleteOperationForm({ operationId, parcelName, areaHa, onCancel, onComplete }: Props) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [flightAreaHa, setFlightAreaHa] = useState(areaHa?.toFixed(1) || '');
  const [products, setProducts] = useState<Array<{ name: string; dose: string; unit: string }>>([
    { name: '', dose: '', unit: 'L/ha' },
  ]);
  const [applicationMethod, setApplicationMethod] = useState('');
  const [temp, setTemp] = useState('');
  const [windKmh, setWindKmh] = useState('');
  const [humidity, setHumidity] = useState('');

  const completeMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        flightLog: {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          areaHa: parseFloat(flightAreaHa),
        },
      };

      const validProducts = products
        .filter((p) => p.name.trim() && p.dose && parseFloat(p.dose) > 0)
        .map((p) => ({ name: p.name.trim(), dose: parseFloat(p.dose), unit: p.unit }));
      if (validProducts.length > 0) {
        body.products = validProducts;
      }

      if (applicationMethod) {
        body.applicationMethod = applicationMethod;
      }

      if (temp && windKmh && humidity) {
        body.weatherConditions = {
          temp: parseFloat(temp),
          windKmh: parseFloat(windKmh),
          humidity: parseFloat(humidity),
        };
      }

      await api.patch(`/operations/${operationId}/complete`, body);
    },
    onSuccess: () => {
      toast.success('Operacion completada con exito');
      onComplete();
    },
    onError: () => toast.error('Error al completar la operacion'),
  });

  const canSubmit = startTime && endTime && flightAreaHa && parseFloat(flightAreaHa) > 0;

  return (
    <div>
      <button
        onClick={onCancel}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
      >
        &larr; Volver
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h1 className="text-xl font-bold text-gray-900">Completar Operacion</h1>
        <p className="text-sm text-gray-500 mt-1">Parcela: {parcelName}</p>
      </div>

      {completeMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          Error al completar la operacion. Verifica los datos e intenta de nuevo.
        </div>
      )}

      <div className="space-y-4">
        {/* Flight log - required */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Datos de Vuelo *
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Hora inicio</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Hora fin</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Area tratada (ha)</label>
              <input
                type="number"
                step="0.1"
                value={flightAreaHa}
                onChange={(e) => setFlightAreaHa(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Productos aplicados (mezcla de tanque · multi-producto con unidad) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Productos aplicados
            </h2>
            <button
              type="button"
              onClick={() => setProducts((ps) => [...ps, { name: '', dose: '', unit: 'L/ha' }])}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              + Añadir producto
            </button>
          </div>
          {/* Autocompletado desde el catálogo de etiqueta (productCatalog.ts) */}
          <datalist id="product-catalog-names">
            {PRODUCT_CATALOG.map((cp) => (
              <option key={cp.id} value={cp.name} />
            ))}
          </datalist>
          <div className="space-y-3">
            {products.map((p, i) => {
              // Dosis tecleada vs rango de ETIQUETA (vía dron) si el producto
              // está catalogado y la unidad coincide. Aviso, no bloqueo: la
              // decisión final es del técnico.
              const spec = findCatalogProduct(p.name);
              const label = spec?.methods.dron && spec.methods.dron.dose.unit === p.unit
                ? spec.methods.dron.dose
                : undefined;
              const doseNum = parseFloat(p.dose);
              const outOfLabel = label && Number.isFinite(doseNum) && doseNum > 0
                ? doseNum < label.min || doseNum > label.max
                : false;
              return (
                <div key={i}>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-6">
                      <label className="block text-sm text-gray-600 mb-1">Producto</label>
                      <input
                        type="text"
                        list="product-catalog-names"
                        value={p.name}
                        onChange={(e) => setProducts((ps) => ps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                        placeholder="Ej: Love Green · LG-MINER"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm text-gray-600 mb-1">Dosis / ha</label>
                      <input
                        type="number"
                        step="any"
                        value={p.dose}
                        onChange={(e) => setProducts((ps) => ps.map((x, j) => (j === i ? { ...x, dose: e.target.value } : x)))}
                        placeholder={label ? labelRangeText(label) : 'Ej: 750'}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
                          outOfLabel ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                        }`}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-600 mb-1">Unidad</label>
                      <select
                        value={p.unit}
                        onChange={(e) => setProducts((ps) => ps.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))}
                        className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      >
                        {APPLICATION_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      {products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setProducts((ps) => ps.filter((_, j) => j !== i))}
                          title="Quitar producto"
                          className="text-gray-400 hover:text-red-600 py-2 px-2 text-lg leading-none"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  {label && (
                    <p className={`mt-1 text-xs ${outOfLabel ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>
                      Etiqueta (dron): {labelRangeText(label)} · agua {spec!.methods.dron!.waterLPerHa.min}–{spec!.methods.dron!.waterLPerHa.max} L/ha
                      {outOfLabel ? ' · dosis FUERA de etiqueta — consulte a su técnico' : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <label className="block text-sm text-gray-600 mb-1">Metodo de aplicacion</label>
            <input
              type="text"
              value={applicationMethod}
              onChange={(e) => setApplicationMethod(e.target.value)}
              placeholder="Ej: Pulverizacion aerea con dron multirotor"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>

        {/* Weather - optional */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Condiciones Meteorologicas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Temperatura (°C)</label>
              <input
                type="number"
                step="0.5"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                placeholder="Ej: 22"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Viento (km/h)</label>
              <input
                type="number"
                step="1"
                value={windKmh}
                onChange={(e) => setWindKmh(e.target.value)}
                placeholder="Ej: 8"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Humedad (%)</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={humidity}
                onChange={(e) => setHumidity(e.target.value)}
                placeholder="Ej: 55"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => completeMutation.mutate()}
          disabled={!canSubmit || completeMutation.isPending}
          className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
        >
          {completeMutation.isPending ? 'Completando...' : 'Completar y registrar vuelo'}
        </button>
        <button
          onClick={onCancel}
          className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
