import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

/**
 * Sprint Bridge DJI → FitoLink · Fase 0 · importador admin/operador.
 *
 * Reusa el parser client-side (lib/missionParser · togeojson + JSZip) del
 * importador de autoservicio del agricultor, pero añade lo que faltaba para
 * el flujo operador→cliente: elegir bajo QUÉ cliente se crean las parcelas
 * (existente o nuevo creado al vuelo). Cierra el gap "Mis Parcelas no
 * distingue titular". Postea a POST /admin/parcels/import.
 */

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
  'Badajoz', 'Caceres', 'Huesca', 'Teruel', 'Zaragoza',
  'Lleida', 'Tarragona', 'Murcia', 'Valencia', 'Alicante', 'Castellon', 'Madrid',
];

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
}

type ClientMode = 'existing' | 'new';

export default function AdminImportParcelsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [polygons, setPolygons] = useState<PolygonFeature[]>([]);
  const [filename, setFilename] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [cropType, setCropType] = useState('');
  const [province, setProvince] = useState('');
  const [markApplication, setMarkApplication] = useState(false);

  const [clientMode, setClientMode] = useState<ClientMode>('existing');
  const [ownerId, setOwnerId] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const { data: clients } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
      return (res.data.data as AdminUser[]).filter((u) => u.role === 'farmer');
    },
  });

  const previewFc = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: polygons.map((p) => ({
        type: 'Feature' as const,
        properties: { name: p.name },
        geometry: p.geometry,
      })),
    }),
    [polygons],
  );
  const bounds = polygons.length > 0 ? L.geoJSON(previewFc).getBounds() : null;
  const totalHa = polygons.reduce((s, p) => s + (p.areaHa || 0), 0);

  // Carga por lote: acepta N archivos (o una carpeta entera). Cada archivo
  // KML/KMZ/GPX/GeoJSON puede traer 1..N polígonos; los acumulamos todos.
  // Si un archivo aporta un único polígono sin nombre propio, usamos el
  // nombre del fichero (sin extensión) como etiqueta por defecto.
  const baseName = (fn: string) => fn.replace(/\.[^.]+$/, '').trim();

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setParseError(null);
    const accepted = files.filter((f) => /\.(kml|kmz|gpx|geojson|json)$/i.test(f.name));
    if (accepted.length === 0) {
      setParseError('Ningún archivo con extensión .kml/.kmz/.gpx/.geojson');
      return;
    }
    const errors: string[] = [];
    const collected: PolygonFeature[] = [];
    for (const file of accepted) {
      try {
        const fc = await parseMissionFile(file);
        const polys = extractPolygons(fc);
        if (polys.length === 0) {
          errors.push(`${file.name}: sin polígonos`);
          continue;
        }
        polys.forEach((p, i) => {
          const generic = !p.name || /^parcela\b/i.test(p.name);
          const name = generic
            ? baseName(file.name) + (polys.length > 1 ? ` (${i + 1})` : '')
            : p.name;
          collected.push({ ...p, name });
        });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'PARSE_ERROR';
        errors.push(`${file.name}: ${ERROR_MESSAGES[code] || code}`);
      }
    }
    setPolygons((prev) => [...prev, ...collected]);
    setFilename(
      accepted.length === 1 ? accepted[0].name : `${accepted.length} archivos`,
    );
    if (errors.length) setParseError(`${errors.length} archivo(s) con problemas: ${errors.slice(0, 3).join(' · ')}`);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length) void handleFiles(files);
    },
    [handleFiles],
  );
  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length) void handleFiles(files);
      e.target.value = '';
    },
    [handleFiles],
  );

  const renameOne = (idx: number, name: string) =>
    setPolygons((prev) => prev.map((p, i) => (i === idx ? { ...p, name } : p)));
  const removeOne = (idx: number) =>
    setPolygons((prev) => prev.filter((_, i) => i !== idx));

  const clientReady =
    clientMode === 'existing' ? !!ownerId : newName.trim().length >= 2 && /.+@.+\..+/.test(newEmail);
  // La provincia es obligatoria en el modelo Parcel: sin ella el import
  // fallaba en el servidor con un 500 sin explicación.
  const canSubmit = polygons.length > 0 && !!cropType && !!province && clientReady;

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        province: province || undefined,
        parcels: polygons.map((p) => ({
          name: p.name,
          geometry: p.geometry,
          areaHa: p.areaHa || 0,
          cropType,
          ...(markApplication ? { applicationTarget: true, applicationCrop: cropType } : {}),
        })),
      };
      if (clientMode === 'existing') body.ownerId = ownerId;
      else body.newOwner = { name: newName.trim(), email: newEmail.trim(), phone: newPhone || undefined };
      const res = await api.post('/admin/parcels/import', body);
      return res.data.data as { ownerName: string; created: number; updated: number };
    },
    onSuccess: (data) => {
      toast.success(
        `${data.created} creada(s) · ${data.updated} actualizada(s) bajo ${data.ownerName}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['parcels'] });
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      navigate('/dashboard/admin/users');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } }; message?: string }) => {
      const raw = e.response?.data?.error?.message ?? e.message ?? 'Error al importar';
      toast.error(raw.slice(0, 200));
    },
  });

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* File inputs siempre montados para que el dropzone y "Añadir más" los alcancen */}
      <input
        id="admin-kmz-input"
        type="file"
        accept=".kml,.kmz,.gpx,.geojson,.json"
        multiple
        onChange={onPick}
        className="hidden"
      />
      {/* webkitdirectory: selección de carpeta entera (Chrome/Edge). */}
      <input
        id="admin-kmz-dir"
        type="file"
        /* @ts-expect-error webkitdirectory no está en los tipos estándar */
        webkitdirectory=""
        directory=""
        multiple
        onChange={onPick}
        className="hidden"
      />
      <div>
        <h1 className="text-2xl font-serif text-gray-900">Importar parcelas de cliente</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sube el KMZ/KML del mando DJI (o KML/GPX/GeoJSON) y asígnalo a un cliente. Las geometrías
          se crean bajo su cuenta, no bajo la tuya.
        </p>
      </div>

      {/* Paso 1 · cliente destino */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-bold text-gray-900">1 · Cliente destino</p>
        <div className="flex gap-2">
          <button
            onClick={() => setClientMode('existing')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              clientMode === 'existing'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 text-gray-600'
            }`}
          >
            Cliente existente
          </button>
          <button
            onClick={() => setClientMode('new')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              clientMode === 'new'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 text-gray-600'
            }`}
          >
            Cliente nuevo
          </button>
        </div>

        {clientMode === 'existing' ? (
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">— Selecciona cliente —</option>
            {(clients ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} · {c.email}
              </option>
            ))}
          </select>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              placeholder="Nombre del cliente"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Teléfono (opcional)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {/* Paso 2 · archivo */}
      {polygons.length === 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-300 bg-gray-50 hover:border-brand-400'
          }`}
        >
          <label htmlFor="admin-kmz-input" className="cursor-pointer block">
            <img src="/import-parcel.svg" alt="" className="w-16 h-16 mx-auto mb-4" />
            <p className="text-base font-semibold text-gray-900">
              2 · Suelta aquí los KMZ/KML del mando DJI
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Uno o varios archivos a la vez · también KML, GPX o GeoJSON
            </p>
          </label>
          <div className="mt-4">
            <label
              htmlFor="admin-kmz-dir"
              className="inline-block cursor-pointer text-xs text-brand-700 underline"
            >
              …o selecciona una carpeta entera
            </label>
          </div>
          {parseError && <p className="text-sm text-amber-600 mt-4">{parseError}</p>}
        </div>
      )}

      {/* Paso 3 · preview + config */}
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
              <div className="flex items-center gap-3">
                <label htmlFor="admin-kmz-input" className="text-xs text-brand-700 hover:text-brand-800 underline cursor-pointer">
                  + Añadir más
                </label>
                <button
                  onClick={() => {
                    setPolygons([]);
                    setFilename(null);
                    setParseError(null);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Vaciar
                </button>
              </div>
            </div>

            <div className="h-72 relative">
              <MapContainer key={polygons.length} bounds={bounds!} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <TileLayer
                  attribution="Tiles &copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                <GeoJSON data={previewFc} style={{ color: '#46632e', weight: 2, fillColor: '#bbf7d0', fillOpacity: 0.35 }} />
              </MapContainer>
            </div>

            <div className="p-3 max-h-64 overflow-y-auto divide-y divide-gray-100">
              {polygons.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <input
                    value={p.name}
                    onChange={(e) => renameOne(i, e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-gray-500 w-16 text-right">{p.areaHa.toFixed(2)} ha</span>
                  {p.areaHa > 0 && p.areaHa < 0.15 && (
                    <span className="text-[10px] text-amber-600" title="Sin resolución satelital útil (Sentinel-2 10 m)">
                      sin S2
                    </span>
                  )}
                  <button onClick={() => removeOne(i)} className="text-gray-400 hover:text-red-500 text-sm">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-bold text-gray-900">3 · Cultivo y opciones</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select value={cropType} onChange={(e) => setCropType(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">— Cultivo —</option>
                {CROP_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <select value={province} onChange={(e) => setProvince(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">— Provincia —</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={markApplication} onChange={(e) => setMarkApplication(e.target.checked)} />
              Marcar como objetivo de aplicación aérea (dron)
            </label>
          </div>

          <button
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition-colors"
          >
            {mutation.isPending ? 'Importando…' : `Importar ${polygons.length} parcela(s) bajo el cliente`}
          </button>
        </>
      )}
    </div>
  );
}
