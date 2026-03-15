import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import ParcelDrawMap from './ParcelDrawMap.js';

const CROP_TYPES = [
  { value: 'olivo', label: 'Olivo' },
  { value: 'vinedo', label: 'Vinedo' },
  { value: 'cereal', label: 'Cereal' },
  { value: 'girasol', label: 'Girasol' },
  { value: 'algodon', label: 'Algodon' },
  { value: 'frutal', label: 'Frutal' },
  { value: 'hortaliza', label: 'Hortaliza' },
  { value: 'citrico', label: 'Citrico' },
  { value: 'almendro', label: 'Almendro' },
  { value: 'arroz', label: 'Arroz' },
  { value: 'maiz', label: 'Maiz' },
  { value: 'remolacha', label: 'Remolacha' },
  { value: 'patata', label: 'Patata' },
  { value: 'leguminosa', label: 'Leguminosa' },
  { value: 'otro', label: 'Otro' },
];

const PROVINCES = [
  'Almeria', 'Cadiz', 'Cordoba', 'Granada', 'Huelva', 'Jaen', 'Malaga', 'Sevilla',
  'Albacete', 'Ciudad Real', 'Cuenca', 'Guadalajara', 'Toledo',
  'Badajoz', 'Caceres',
  'Huesca', 'Teruel', 'Zaragoza',
  'Lleida', 'Tarragona',
  'Murcia',
  'Valencia', 'Alicante', 'Castellon',
];

export default function CreateParcelPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [cropType, setCropType] = useState('');
  const [province, setProvince] = useState('');
  const [sigpacRef, setSigpacRef] = useState('');
  const [geometry, setGeometry] = useState<GeoJSON.Polygon | null>(null);
  const [areaHa, setAreaHa] = useState(0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!geometry) throw new Error('Dibuja la parcela en el mapa');
      const res = await api.post('/parcels', {
        name,
        geometry,
        areaHa: areaHa || 1,
        cropType,
        province,
        sigpacRef: sigpacRef || undefined,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parcels', 'mine'] });
      navigate('/dashboard/parcels');
    },
  });

  const isValid = name && cropType && province && geometry;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nueva Parcela</h1>
        <p className="text-gray-500 text-sm mt-1">
          Dibuja el contorno de tu parcela en el mapa y completa los datos
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dibuja tu parcela en el mapa
          </label>
          <ParcelDrawMap
            onPolygonCreated={(geo, area) => {
              setGeometry(geo);
              setAreaHa(area);
            }}
          />
          {areaHa > 0 && (
            <p className="text-sm text-brand-600 mt-2 font-medium">
              Area: {areaHa.toFixed(2)} ha
            </p>
          )}
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la parcela
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Parcela Norte - Los Olivos"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de cultivo
            </label>
            <select
              value={cropType}
              onChange={(e) => setCropType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            >
              <option value="">Seleccionar...</option>
              {CROP_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provincia
            </label>
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            >
              <option value="">Seleccionar...</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referencia SIGPAC <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={sigpacRef}
              onChange={(e) => setSigpacRef(e.target.value)}
              placeholder="Ej: 14-041-0-0-12-34-1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">
              {(mutation.error as Error).message || 'Error al crear la parcela'}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => mutation.mutate()}
              disabled={!isValid || mutation.isPending}
              className="flex-1 bg-brand-600 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
            >
              {mutation.isPending ? 'Guardando...' : 'Guardar parcela'}
            </button>
            <button
              onClick={() => navigate('/dashboard/parcels')}
              className="border border-gray-300 text-gray-600 text-sm px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
