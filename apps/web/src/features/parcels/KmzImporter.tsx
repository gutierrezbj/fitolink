import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { api } from '@/lib/api.js';
import { toast } from '@/stores/toastStore.js';
import {
  parseMissionFile,
  extractPolygons,
  ERROR_MESSAGES,
  type PolygonFeature,
} from '@/lib/missionParser.js';

const CROP_TYPES = [
  { value: 'olivo', label: 'Olivo' },
  { value: 'vinedo', label: 'Viñedo' },
  { value: 'cereal', label: 'Cereal' },
  { value: 'girasol', label: 'Girasol' },
  { value: 'algodon', label: 'Algodón' },
  { value: 'frutal', label: 'Frutal' },
  { value: 'aguacate', label: 'Aguacate' },
  { value: 'hortaliza', label: 'Hortaliza' },
  { value: 'citrico', label: 'Cítrico' },
  { value: 'almendro', label: 'Almendro' },
  { value: 'pistacho', label: 'Pistacho' },
  { value: 'arroz', label: 'Arroz' },
  { value: 'maiz', label: 'Maíz' },
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

export default function KmzImporter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [polygons, setPolygons] = useState<PolygonFeature[]>([]);
  const [filename, setFilename] = useState<string | null>(null);
  const [cropType, setCropType] = useState<string>('');
  const [province, setProvince] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setParseError(null);
    setFilename(file.name);
    try {
      const fc = await parseMissionFile(file);
      const polys = extractPolygons(fc);
      if (polys.length === 0) {
        throw new Error('EMPTY_MISSION');
      }
      setPolygons(polys);
    } catch (e) {
      const code = e instanceof Error ? e.message : 'PARSE_ERROR';
      setParseError(ERROR_MESSAGES[code] || code);
      setPolygons([]);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const removeOne = (idx: number) => {
    setPolygons((prev) => prev.filter((_, i) => i !== idx));
  };

  const renameOne = (idx: number, name: string) => {
    setPolygons((prev) => prev.map((p, i) => (i === idx ? { ...p, name } : p)));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        parcels: polygons.map((p) => ({
          name: p.name,
          geometry: p.geometry,
          areaHa: p.areaHa || 1,
          cropType,
          province,
        })),
      };
      const res = await api.post('/parcels/bulk', payload);
      return res.data;
    },
    onSuccess: (data: { meta?: { count?: number } }) => {
      const n = data.meta?.count ?? polygons.length;
      toast.success(`${n} parcelas importadas correctamente`);
      void queryClient.invalidateQueries({ queryKey: ['parcels'] });
      navigate('/dashboard/parcels');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } }; message?: string }) => {
      const raw = e.response?.data?.error?.message ?? e.message ?? 'Error al crear las parcelas';
      // Validation errors can be 1-2k characters of "field.path: detail"
      // chains — show only the first issue and a short hint.
      const firstLine = raw.split(/[,\n]/)[0]?.trim() ?? raw;
      const truncated = firstLine.length > 160 ? firstLine.slice(0, 160) + '…' : firstLine;
      toast.error(truncated);
    },
  });

  const isReady = polygons.length > 0 && cropType && province;
  const totalHa = polygons.reduce((s, p) => s + p.areaHa, 0);

  // Build a FeatureCollection for the preview map
  const previewFc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: polygons.map((p, i) => ({
      type: 'Feature',
      geometry: p.geometry,
      properties: { name: p.name, idx: i },
    })),
  };

  // Compute bounds-ready polygons via L.geoJSON
  const bounds = polygons.length > 0
    ? L.geoJSON(previewFc).getBounds()
    : null;

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      {polygons.length === 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
            dragOver
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-300 bg-gray-50 hover:border-brand-400'
          }`}
        >
          <input
            id="kmz-input"
            type="file"
            accept=".kml,.kmz,.gpx,.geojson,.json"
            onChange={onPick}
            className="hidden"
          />
          <label htmlFor="kmz-input" className="cursor-pointer block">
            <img src="/import-parcel.svg" alt="" className="w-16 h-16 mx-auto mb-4" />
            <p className="text-base font-semibold text-gray-900">
              Suelta aquí tu KMZ, KML, GPX o GeoJSON
            </p>
            <p className="text-sm text-gray-500 mt-1">
              o haz click para elegir un archivo · máximo 10 MB
            </p>
            {parseError && (
              <p className="text-sm text-red-600 mt-3 font-medium">{parseError}</p>
            )}
          </label>
        </div>
      )}

      {/* Preview */}
      {polygons.length > 0 && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {polygons.length} parcela{polygons.length > 1 ? 's' : ''} detectada
                  {polygons.length > 1 ? 's' : ''} en {filename}
                </p>
                <p className="text-xs text-gray-500">
                  Superficie total: <b>{totalHa.toFixed(1)} ha</b>
                </p>
              </div>
              <button
                onClick={() => {
                  setPolygons([]);
                  setFilename(null);
                  setParseError(null);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Cambiar archivo
              </button>
            </div>

            {/* Map preview */}
            <div className="h-72 relative">
              <MapContainer
                key={polygons.length}
                bounds={bounds!}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution="Tiles &copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                <TileLayer
                  attribution=""
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                  opacity={0.6}
                />
                <GeoJSON
                  data={previewFc}
                  style={{ color: '#46632e', weight: 2, fillColor: '#bbf7d0', fillOpacity: 0.35 }}
                />
              </MapContainer>
            </div>

            {/* List of polygons (editable name) */}
            <div className="p-3 max-h-64 overflow-y-auto divide-y divide-gray-100">
              {polygons.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <input
                    value={p.name}
                    onChange={(e) => renameOne(i, e.target.value)}
                    className="flex-1 text-sm text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-brand-400 focus:outline-none px-1 py-0.5"
                  />
                  <span className="text-xs text-gray-500 font-medium flex-shrink-0">
                    {p.areaHa.toFixed(2)} ha
                  </span>
                  <button
                    onClick={() => removeOne(i)}
                    className="text-gray-300 hover:text-red-500 text-sm flex-shrink-0 px-1"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cultivo + Provincia (aplica a todas) */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-1">
              Datos comunes (se aplican a las {polygons.length} parcelas)
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Si necesitas cultivos o provincias distintos por parcela, podrás editarlos
              luego desde la ficha de cada una.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cultivo</label>
                <select
                  value={cropType}
                  onChange={(e) => setCropType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">Selecciona cultivo</option>
                  {CROP_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Provincia</label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">Selecciona provincia</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => navigate('/dashboard/parcels')}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!isReady || mutation.isPending}
              className="bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {mutation.isPending
                ? 'Creando…'
                : `Crear ${polygons.length} parcela${polygons.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
