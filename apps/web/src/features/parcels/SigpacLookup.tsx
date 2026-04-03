import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '@/lib/api.js';

interface SigpacFields {
  prov: string;
  muni: string;
  agre: string;
  zona: string;
  poligono: string;
  parcela: string;
  recinto: string;
}

interface SigpacResult {
  geometry: GeoJSON.Polygon;
  areaHa: number;
  sigpacRef: string;
  cropUse: string;
}

interface SigpacLookupProps {
  onResult: (result: SigpacResult) => void;
}

const FIELD_DEFS: { key: keyof SigpacFields; label: string }[] = [
  { key: 'prov',     label: 'Provincia' },
  { key: 'muni',     label: 'Municipio' },
  { key: 'agre',     label: 'Agregado' },
  { key: 'zona',     label: 'Zona' },
  { key: 'poligono', label: 'Polígono' },
  { key: 'parcela',  label: 'Parcela' },
  { key: 'recinto',  label: 'Recinto' },
];

const EMPTY_FIELDS: SigpacFields = {
  prov: '', muni: '', agre: '', zona: '', poligono: '', parcela: '', recinto: '',
};

function FitGeometry({ geometry }: { geometry: GeoJSON.Polygon }) {
  const map = useMap();
  const layer = L.geoJSON(geometry as GeoJSON.GeoJsonObject);
  map.fitBounds(layer.getBounds(), { padding: [16, 16] });
  return null;
}

export default function SigpacLookup({ onResult }: SigpacLookupProps) {
  const [fields, setFields] = useState<SigpacFields>(EMPTY_FIELDS);
  const [found, setFound] = useState<SigpacResult | null>(null);

  const allFilled = Object.values(fields).every((v) => v.trim() !== '');

  const lookup = useMutation({
    mutationFn: async (f: SigpacFields) => {
      const res = await api.get<{ data: SigpacResult }>('/sigpac/lookup', {
        params: {
          prov:     f.prov,
          muni:     f.muni,
          agre:     f.agre,
          zona:     f.zona,
          poligono: f.poligono,
          parcela:  f.parcela,
          recinto:  f.recinto,
        },
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setFound(data);
      onResult(data);
    },
  });

  function handleChange(key: keyof SigpacFields, value: string) {
    // Accept only digits
    if (value !== '' && !/^\d+$/.test(value)) return;
    setFound(null);
    lookup.reset();
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allFilled) return;
    lookup.mutate(fields);
  }

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-4">
      <p className="text-sm font-semibold text-gray-700">Buscar parcela en SIGPAC</p>

      <form onSubmit={handleSubmit} noValidate>
        {/* 6-field row */}
        <div className="grid grid-cols-7 gap-2 mb-3">
          {FIELD_DEFS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wide">
                {label}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                value={fields[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                aria-label={label}
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={!allFilled || lookup.isPending}
          className="w-full bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
        >
          {lookup.isPending ? 'Buscando...' : 'Buscar en SIGPAC'}
        </button>
      </form>

      {/* Error */}
      {lookup.isError && (
        <p className="text-sm text-red-600">
          {(lookup.error as { response?: { data?: { message?: string } } }).response?.data?.message
            ?? (lookup.error as Error).message
            ?? 'No se pudo encontrar la parcela en SIGPAC'}
        </p>
      )}

      {/* Success banner */}
      {found && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-green-800 font-medium">
              Parcela encontrada: {found.areaHa.toFixed(2)} ha &middot; uso: {found.cropUse}
            </span>
          </div>

          {/* Mini map preview */}
          <MapContainer
            center={[39.0, -3.5]}
            zoom={14}
            style={{ height: '160px', width: '100%' }}
            className="rounded-lg border border-gray-200"
            zoomControl={false}
            dragging={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            touchZoom={false}
            keyboard={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            <GeoJSON
              data={found.geometry as GeoJSON.GeoJsonObject}
              style={{ color: '#22c55e', weight: 2, fillColor: '#22c55e', fillOpacity: 0.2 }}
            />
            <FitGeometry geometry={found.geometry} />
          </MapContainer>
        </div>
      )}
    </div>
  );
}
