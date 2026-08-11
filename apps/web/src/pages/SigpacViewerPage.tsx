import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '@/lib/api.js';
import { fetchForecast, weatherLabel, windCardinal } from '@/features/weather/openMeteo.js';
import { polygonCentroid } from '@/features/marketplace/distance.js';

/**
 * Visor SIGPAC público · alternativa decente al visor oficial MAPA.
 *
 * Página standalone sin login. Cualquiera puede buscar una parcela
 * catastral por código y verla con tiles satellite Esri (mucho mejor
 * que el visor oficial). Conversion path: tras ver su parcela el
 * agricultor puede crear cuenta y monitorizarla con FitoLink.
 *
 * Sprint Visor SIGPAC público · 04-jun-2026.
 *
 * Rutas:
 *   /sigpac                     → formulario vacío
 *   /sigpac/:prov/:muni/...     → enlace directo a una parcela (compartible)
 */

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

const FIELD_DEFS: { key: keyof SigpacFields; label: string; placeholder: string }[] = [
  { key: 'prov',     label: 'Prov',     placeholder: 'ej 23' },
  { key: 'muni',     label: 'Muni',     placeholder: '1' },
  { key: 'agre',     label: 'Agr',      placeholder: '0' },
  { key: 'zona',     label: 'Zona',     placeholder: '0' },
  { key: 'poligono', label: 'Políg.',  placeholder: '10' },
  { key: 'parcela',  label: 'Parc.',    placeholder: '15' },
  { key: 'recinto',  label: 'Rec.',     placeholder: '1' },
];

const EMPTY_FIELDS: SigpacFields = {
  prov: '', muni: '', agre: '', zona: '', poligono: '', parcela: '', recinto: '',
};

// Códigos SIGPAC de usos más comunes — castellanizados para mostrar al usuario
const USO_SIGPAC: Record<string, string> = {
  OV: 'Olivar',
  VI: 'Viñedo',
  TA: 'Tierra arable',
  FY: 'Frutales',
  CI: 'Cítricos',
  PR: 'Pastos / pradera',
  PA: 'Pasto arbolado',
  PS: 'Pasto arbustivo',
  FO: 'Forestal',
  IM: 'Improductivo',
  ED: 'Edificación',
  AG: 'Agua',
  TH: 'Huerta',
  VF: 'Viñedo-frutal',
  OF: 'Olivar-frutal',
  CF: 'Cítricos-frutales',
};

/**
 * Convierte un Polygon GeoJSON a string KML 2.2 mínimo válido.
 *
 * Format target: KML 2.2 (OGC standard). Compatible con Google Earth,
 * DJI GS Pro, Litchi, DroneDeploy, Pix4D, QGIS, ArcGIS Field Maps.
 *
 * Asume Polygon (no MultiPolygon) — todos los recintos SIGPAC son
 * polígonos simples sin huecos, así que ignoramos rings interiores.
 */
function buildKmlFromGeometry(
  geometry: GeoJSON.Polygon,
  ref: string,
  cropUseLabel: string,
  areaHa: number,
): string {
  const outerRing = geometry.coordinates[0] ?? [];
  const coords = outerRing.map(([lng, lat]) => `${lng},${lat},0`).join(' ');
  // terra-500 #d45220 en formato AABBGGRR usado por KML.
  // alpha 88 (~53%) para que el relleno deje ver el satellite debajo.
  const fillColor = '882052d4';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '  <Document>',
    `    <name>Parcela SIGPAC ${escapeXml(ref)}</name>`,
    `    <description>Recinto catastral SIGPAC oficial. Uso: ${escapeXml(cropUseLabel)}. Superficie: ${areaHa.toFixed(2)} ha. Generado por AgroM · FitoLink (fitolink.agrom.es).</description>`,
    '    <Style id="agrom-parcela">',
    '      <LineStyle>',
    '        <color>ff2052d4</color>',
    '        <width>3</width>',
    '      </LineStyle>',
    '      <PolyStyle>',
    `        <color>${fillColor}</color>`,
    '        <fill>1</fill>',
    '        <outline>1</outline>',
    '      </PolyStyle>',
    '    </Style>',
    '    <Placemark>',
    `      <name>SIGPAC ${escapeXml(ref)}</name>`,
    `      <description>${escapeXml(cropUseLabel)} · ${areaHa.toFixed(2)} ha</description>`,
    '      <styleUrl>#agrom-parcela</styleUrl>',
    '      <Polygon>',
    '        <outerBoundaryIs>',
    '          <LinearRing>',
    `            <coordinates>${coords}</coordinates>`,
    '          </LinearRing>',
    '        </outerBoundaryIs>',
    '      </Polygon>',
    '    </Placemark>',
    '  </Document>',
    '</kml>',
  ].join('\n');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Descarga un blob como archivo. Util compartido entre descargas KML
 * y GeoJSON. createObjectURL + click sintético es la forma estándar
 * (sin librerías) compatible con todos los navegadores actuales.
 */
function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Cleanup tras un tick para que algunos navegadores (Safari)
  // tengan tiempo de iniciar la descarga antes de invalidar la URL.
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function FitGeometry({ geometry }: { geometry: GeoJSON.Polygon }) {
  const map = useMap();
  const layer = L.geoJSON(geometry as GeoJSON.GeoJsonObject);
  map.fitBounds(layer.getBounds(), { padding: [24, 24] });
  return null;
}

export default function SigpacViewerPage() {
  const navigate = useNavigate();
  const params = useParams<Partial<SigpacFields>>();
  const initialFields: SigpacFields = {
    prov: params.prov ?? '',
    muni: params.muni ?? '',
    agre: params.agre ?? '',
    zona: params.zona ?? '',
    poligono: params.poligono ?? '',
    parcela: params.parcela ?? '',
    recinto: params.recinto ?? '',
  };

  const [fields, setFields] = useState<SigpacFields>(initialFields);
  const [found, setFound] = useState<SigpacResult | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCopyLink(ref: string) {
    void navigator.clipboard.writeText(`https://fitolink.agrom.es/sigpac/${ref}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadKml() {
    if (!found) return;
    const cropLabel = USO_SIGPAC[found.cropUse] ?? found.cropUse;
    const kml = buildKmlFromGeometry(found.geometry, found.sigpacRef, cropLabel, found.areaHa);
    // Filename con guiones bajos en la ref (no slashes) para evitar
    // problemas en Windows / DJI Pilot al cargar el archivo.
    const safeRef = found.sigpacRef.replace(/[\/\s]/g, '_');
    downloadBlob(kml, `parcela-sigpac-${safeRef}.kml`, 'application/vnd.google-earth.kml+xml');
  }

  function handleDownloadGeoJson() {
    if (!found) return;
    const cropLabel = USO_SIGPAC[found.cropUse] ?? found.cropUse;
    // Envolvemos en Feature para que tenga properties con metadatos
    // (QGIS los muestra automáticamente en la tabla de atributos).
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: {
        sigpacRef: found.sigpacRef,
        cropUse: found.cropUse,
        cropUseLabel: cropLabel,
        areaHa: Number(found.areaHa.toFixed(2)),
        source: 'AgroM · FitoLink · SIGPAC catastral oficial',
      },
      geometry: found.geometry,
    };
    const json = JSON.stringify(feature, null, 2);
    const safeRef = found.sigpacRef.replace(/[\/\s]/g, '_');
    downloadBlob(json, `parcela-sigpac-${safeRef}.geojson`, 'application/geo+json');
  }

  function handleShareWhatsApp() {
    if (!found || !centroid) return;
    const cropLabel = USO_SIGPAC[found.cropUse] ?? found.cropUse;
    const url = `https://fitolink.agrom.es/sigpac/${found.sigpacRef}`;
    // Texto preformateado · pensado para grupo de cooperativa o WhatsApp 1:1.
    // Incluye contexto mínimo (qué es, dónde, link) y firma sutil de marca.
    const text =
      `📍 Parcela SIGPAC ${found.sigpacRef}\n` +
      `${cropLabel} · ${found.areaHa.toFixed(2)} ha\n\n` +
      `Mírala sobre satellite y consulta el tiempo de hoy:\n${url}\n\n` +
      `— vía AgroM · FitoLink`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  function handleOpenGoogleMaps() {
    if (!centroid) return;
    // centroid llega como [lng, lat] desde polygonCentroid;
    // Google Maps espera lat,lng — invertimos.
    const [lng, lat] = centroid;
    // q=lat,lng es el path mas universal · funciona en Maps web, app
    // iOS, app Android, y respeta navegacion turn-by-turn si el user
    // pulsa el boton dentro de la app.
    const gmapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
    window.open(gmapsUrl, '_blank', 'noopener,noreferrer');
  }

  const allFilled = Object.values(fields).every((v) => v.trim() !== '');

  const lookup = useMutation({
    mutationFn: async (f: SigpacFields) => {
      const res = await api.get<{ data: SigpacResult }>('/sigpac/lookup', {
        params: f,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setFound(data);
      // Push URL para que sea compartible
      navigate(`/sigpac/${fields.prov}/${fields.muni}/${fields.agre}/${fields.zona}/${fields.poligono}/${fields.parcela}/${fields.recinto}`, { replace: true });
    },
  });

  function handleChange(key: keyof SigpacFields, value: string) {
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

  // Auto-search si la URL trae todos los parámetros (compartido)
  useState(() => {
    if (Object.values(initialFields).every((v) => v.trim() !== '')) {
      lookup.mutate(initialFields);
    }
  });

  const usoLabel = found ? (USO_SIGPAC[found.cropUse] ?? found.cropUse) : null;

  // Centroide del polígono para meteo · solo se calcula cuando hay parcela
  const centroid = found ? polygonCentroid(found.geometry) : null;

  // Meteo HOY · gancho gratuito sobre el visor. Llama a Open-Meteo solo
  // cuando hay parcela cargada. Solo mostramos el día 0 al anónimo —
  // los 6 siguientes están detrás del registro. Lead magnet honesto:
  // damos algo útil (tiempo de hoy en SU parcela) y mostramos lo que
  // hay detrás del muro (7 días + ventana drone hora a hora + alertas).
  const weatherQuery = useQuery({
    queryKey: ['sigpac-viewer-weather', centroid?.[0], centroid?.[1]],
    queryFn: () => fetchForecast(centroid![1], centroid![0]),
    enabled: !!centroid,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const today = weatherQuery.data?.daily[0];
  const todayWx = today ? weatherLabel(today.weatherCode) : null;

  function handleReset() {
    setFields(EMPTY_FIELDS);
    setFound(null);
    lookup.reset();
    navigate('/sigpac', { replace: true });
    // Scroll suave al inicio para que el user vea el form vacío listo
    // para escribir desde arriba — sin esto se queda donde estaba
    // mirando el mapa de la parcela anterior y se siente perdido.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen bg-earth-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-earth-300/30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Volver a la página principal" className="inline-flex items-center gap-1.5 rounded-full border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-brand-700 shadow-sm transition-colors hover:border-brand-400 hover:bg-brand-50 active:bg-brand-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Volver
            </Link>
            <Link to="/" className="flex flex-col items-start leading-none gap-1">
              <img src="/brand/agrom-wordmark.svg" alt="AgroM" className="h-6 w-auto" />
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-gray-500 ml-px">
                FitoLink &middot; del pixel al tratamiento
              </span>
            </Link>
          </div>
          <Link
            to="/login"
            className="px-5 py-2 bg-brand-600 text-white rounded-full text-sm font-medium hover:bg-brand-700 transition-all"
          >
            Acceder
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-white border-b border-earth-300/30">
        <div className="max-w-4xl mx-auto px-6 py-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500 mb-3">
            VISOR SIGPAC &middot; AGROM &middot; FITOLINK
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-brand-900 leading-tight mb-3">
            Consulta cualquier parcela catastral en segundos.
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Visor del Sistema de Información Geográfica de Parcelas Agrícolas (SIGPAC) español.
            Sin cuenta, sin instalaciones, sin esperas. Pega tu referencia catastral y mira tu
            parcela sobre imagen satelital de alta resolución.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="max-w-4xl mx-auto w-full px-6 py-8">
        <form onSubmit={handleSubmit} className="bg-white border border-earth-300/30 rounded-xl p-5 shadow-sm">
          <div className="grid grid-cols-7 gap-2 mb-4">
            {FIELD_DEFS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                  {label}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  value={fields[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm text-center focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  aria-label={label}
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={!allFilled || lookup.isPending}
            className="w-full bg-brand-600 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
          >
            {lookup.isPending ? 'Buscando en SIGPAC…' : 'Buscar parcela'}
          </button>
          <p className="text-[11px] text-gray-500 mt-2 text-center">
            Provincia, municipio, agregado, zona, polígono, parcela y recinto. Solo números.
          </p>
        </form>

        {/* Error */}
        {lookup.isError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700">
              {(lookup.error as { response?: { data?: { message?: string } } }).response?.data?.message
                ?? 'No se ha encontrado esa parcela en SIGPAC. Verifica que todos los números son correctos.'}
            </p>
          </div>
        )}

        {/* Resultado */}
        {found && (
          <div className="mt-6 space-y-4">
            {/* Mapa grande */}
            <div className="bg-white border border-earth-300/30 rounded-xl overflow-hidden">
              <div className="bg-brand-600 px-4 py-2.5 flex items-center justify-between gap-3">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-earth-50/80 min-w-0 truncate">
                  § PARCELA &middot; SIGPAC {found.sigpacRef}
                </p>
                <p className="font-mono text-[10px] text-earth-50/60 tracking-wide hidden sm:block">
                  Cat&aacute;stro oficial
                </p>
              </div>
              <MapContainer
                center={[39.0, -3.5]}
                zoom={14}
                style={{ height: '460px', width: '100%' }}
                scrollWheelZoom
              >
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                  attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
                />
                <GeoJSON
                  data={found.geometry as GeoJSON.GeoJsonObject}
                  // terra-500 — el naranja brand de AgroM. Sobre tiles
                  // satellite Esri (verdes/marrones oscuros) destaca mucho
                  // mas que el brand-600 verde topographic que se camufla.
                  style={{ color: '#d45220', weight: 3, fillColor: '#d45220', fillOpacity: 0.22 }}
                />
                <FitGeometry geometry={found.geometry} />
              </MapContainer>
            </div>

            {/* Datos del recinto */}
            <div className="bg-white border border-earth-300/30 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-gray-500">
                  § DATOS DEL RECINTO
                </p>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  aria-label="Buscar otra parcela"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Buscar otra parcela
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">Superficie</p>
                  <p className="font-serif text-2xl text-brand-900 leading-none">{found.areaHa.toFixed(2)} <span className="text-base text-gray-500">ha</span></p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">Uso SIGPAC</p>
                  <p className="font-serif text-2xl text-brand-900 leading-none">{usoLabel}</p>
                  <p className="text-[10px] text-gray-400 mt-1">código: {found.cropUse}</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">Referencia</p>
                  <p className="font-mono text-sm text-brand-900 leading-tight mb-3">{found.sigpacRef}</p>
                  <button
                    onClick={() => handleCopyLink(found.sigpacRef)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        ¡Copiado!
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copiar enlace
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Compartir y exportar · 3 nuevas acciones que multiplican el
                valor del visor para 3 perfiles distintos:
                  · WhatsApp share  → viralidad pasiva en grupos cooperativa
                  · Google Maps     → piloto-dron / agricultor navega al campo
                  · KML + GeoJSON   → asesor agrónomo importa en QGIS y
                    piloto-dron carga geometría en DJI GS Pro / Litchi
                Bloque 05-jun-2026 · Sprint Visor SIGPAC mejoras. */}
            <div className="bg-white border border-earth-300/30 rounded-xl p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-gray-500 mb-4">
                § COMPARTIR Y EXPORTAR
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                  onClick={handleShareWhatsApp}
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5d] active:bg-[#17a851] px-3 py-2.5 rounded-lg text-xs font-medium transition-colors"
                  aria-label="Compartir por WhatsApp"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </button>
                <button
                  onClick={handleOpenGoogleMaps}
                  className="inline-flex items-center justify-center gap-2 bg-gray-700 text-white hover:bg-gray-800 active:bg-gray-900 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors"
                  aria-label="Abrir centroide en Google Maps"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Google Maps
                </button>
                <button
                  onClick={handleDownloadKml}
                  className="inline-flex items-center justify-center gap-2 bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors"
                  aria-label="Descargar KML"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  KML
                </button>
                <button
                  onClick={handleDownloadGeoJson}
                  className="inline-flex items-center justify-center gap-2 bg-earth-200 text-brand-900 hover:bg-earth-300 active:bg-earth-400 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors"
                  aria-label="Descargar GeoJSON"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  GeoJSON
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-3 leading-snug">
                KML para DJI GS Pro, Litchi, Google Earth · GeoJSON para QGIS, ArcGIS, asesor agrónomo · Google Maps abre el centroide para navegar a la finca.
              </p>
            </div>

            {/* Meteo HOY · lead magnet anónimo · 1 día gratis, los 6 siguientes
                detrás del registro. El gancho real del visor: traes a la
                gente a buscar su parcela y, al ver el tiempo en SU campo
                gratis, la conversión se vuelve obvia. */}
            <div className="bg-white border border-earth-300/30 rounded-xl overflow-hidden">
              <div className="bg-brand-600 px-4 py-2.5 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-earth-50/70">
                  § TIEMPO EN SU PARCELA · HOY
                </p>
                <p className="font-mono text-[9px] text-earth-50/60 tracking-wide">
                  Open-Meteo
                </p>
              </div>
              {weatherQuery.isLoading && (
                <div className="px-5 py-6 text-center text-sm text-gray-500">
                  Consultando meteo en {centroid && `${centroid[1].toFixed(4)}, ${centroid[0].toFixed(4)}`}…
                </div>
              )}
              {today && todayWx && (
                <>
                  <div className="px-5 py-5 flex items-center gap-5 flex-wrap">
                    <div className="text-5xl leading-none">{todayWx.emoji}</div>
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-serif text-2xl text-brand-900 leading-tight capitalize">{todayWx.label}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Máx <b className="text-brand-900">{Math.round(today.tempMax)}°</b> ·
                        Mín <b className="text-brand-900">{Math.round(today.tempMin)}°</b> ·
                        Lluvia <b className="text-brand-900">{today.precipSum.toFixed(1)} mm</b>
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500">Viento</p>
                        <p className="text-brand-900 font-medium tabular-nums">{today.windSpeedMax.toFixed(1)} m/s</p>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500">Dirección</p>
                        <p className="text-brand-900 font-medium">{windCardinal(today.windDir)}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500">Prob. lluvia</p>
                        <p className="text-brand-900 font-medium tabular-nums">{today.precipProbMax}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Banner pre-CTA · qué hay detrás del muro */}
                  <div className="px-5 py-4 border-t border-earth-300/30 bg-earth-50">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-brand-900 leading-snug">
                          <b>Los siguientes 6 días</b> + ventana drone hora a hora + alertas de viento, lluvia y calor extremo están a un click.
                        </p>
                        <Link
                          to="/register"
                          className="inline-block mt-2 font-mono text-[10px] uppercase tracking-wider text-brand-600 hover:text-brand-700"
                        >
                          Crea cuenta gratis para ver pronóstico 7 días →
                        </Link>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {weatherQuery.isError && (
                <div className="px-5 py-4 text-sm text-gray-500">
                  No se pudo cargar la previsión meteorológica en este momento.
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="bg-brand-600 rounded-xl p-6 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-earth-50/70 mb-3">
                § MONITORIZA TU PARCELA
              </p>
              <h2 className="font-serif text-2xl md:text-3xl text-white leading-tight mb-3">
                ¿Quieres saber cómo va tu parcela cada semana, sin pisarla?
              </h2>
              <p className="text-earth-50/90 text-sm max-w-2xl mx-auto leading-relaxed mb-5">
                FitoLink vigila tu cultivo con Sentinel-2, MODIS, Landsat térmico y NASA FIRMS — todo gratis.
                Crea tu cuenta en 2 minutos y monitoriza esta parcela desde el primer día.
              </p>
              <Link
                to="/register"
                className="inline-block bg-white text-brand-700 font-semibold px-6 py-3 rounded-lg hover:bg-earth-50 transition-colors text-sm"
              >
                Crear cuenta gratis &rarr;
              </Link>
              <p className="text-earth-50/70 text-[11px] mt-3">
                Sin tarjeta, sin compromiso. Setup en 2 minutos.
              </p>
            </div>
          </div>
        )}

        {/* Empty state · sugerencias */}
        {!found && !lookup.isPending && !lookup.isError && (
          <div className="mt-6 bg-white border border-earth-300/30 rounded-xl p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-3">
              § REFERENCIAS DE EJEMPLO &middot; JAÉN
            </p>
            <p className="text-sm text-gray-600 mb-4">
              ¿No tienes a mano una referencia? Prueba con estas parcelas reales:
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => setFields({ prov: '23', muni: '1', agre: '0', zona: '0', poligono: '10', parcela: '15', recinto: '1' })}
                  className="text-brand-600 hover:text-brand-700 hover:underline"
                >
                  23/1/0/0/10/15/1
                </button>
                <span className="text-gray-500"> &middot; Olivar tradicional Sierra Mágina</span>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setFields({ prov: '23', muni: '74', agre: '0', zona: '0', poligono: '3', parcela: '1', recinto: '1' })}
                  className="text-brand-600 hover:text-brand-700 hover:underline"
                >
                  23/74/0/0/3/1/1
                </button>
                <span className="text-gray-500"> &middot; Olivar de seto intensivo (La Loma)</span>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setFields({ prov: '23', muni: '31', agre: '0', zona: '0', poligono: '3', parcela: '5', recinto: '1' })}
                  className="text-brand-600 hover:text-brand-700 hover:underline"
                >
                  23/31/0/0/3/5/1
                </button>
                <span className="text-gray-500"> &middot; Pistachar joven (Frailes)</span>
              </li>
            </ul>
            <p className="text-[11px] text-gray-400 mt-4">
              Click sobre la referencia → rellena el formulario → click <em>Buscar parcela</em>.
            </p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-earth-300/30 py-5">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-500 mb-2">
            AGROM &middot; INTELIGENCIA AGRARIA DE PRECISIÓN
          </p>
          <p className="text-xs text-gray-400">
            Datos SIGPAC oficiales del MAPA &middot; Visor desarrollado por SystemRapid SL para FitoLink &middot; Sin uso comercial restringido.
          </p>
        </div>
      </footer>
    </div>
  );
}
