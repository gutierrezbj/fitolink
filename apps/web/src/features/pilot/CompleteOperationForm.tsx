import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
  const [productName, setProductName] = useState('');
  const [activeSubstance, setActiveSubstance] = useState('');
  const [doseLPerHa, setDoseLPerHa] = useState('');
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

      if (productName && activeSubstance && doseLPerHa) {
        body.product = {
          name: productName,
          activeSubstance,
          doseLPerHa: parseFloat(doseLPerHa),
        };
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

        {/* Product - optional */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Producto Aplicado
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nombre del producto</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ej: Confidor 20 LS"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Sustancia activa</label>
              <input
                type="text"
                value={activeSubstance}
                onChange={(e) => setActiveSubstance(e.target.value)}
                placeholder="Ej: Imidacloprid"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Dosis (L/ha)</label>
              <input
                type="number"
                step="0.1"
                value={doseLPerHa}
                onChange={(e) => setDoseLPerHa(e.target.value)}
                placeholder="Ej: 0.5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
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
