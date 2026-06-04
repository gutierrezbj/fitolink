import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '@/lib/api.js';

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

  return (
    <div className="min-h-screen bg-earth-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-earth-300/30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex flex-col items-start leading-none gap-1">
            <img src="/brand/agrom-wordmark.svg" alt="AgroM" className="h-6 w-auto" />
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-gray-500 ml-px">
              FitoLink &middot; del pixel al tratamiento
            </span>
          </Link>
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
              <div className="bg-brand-600 px-4 py-2.5 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-earth-50/70">
                  § PARCELA &middot; SIGPAC {found.sigpacRef}
                </p>
                <p className="font-mono text-[9px] text-earth-50/60 tracking-wide">
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
                  style={{ color: '#46632e', weight: 3, fillColor: '#46632e', fillOpacity: 0.20 }}
                />
                <FitGeometry geometry={found.geometry} />
              </MapContainer>
            </div>

            {/* Datos del recinto */}
            <div className="bg-white border border-earth-300/30 rounded-xl p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-3">
                § DATOS DEL RECINTO
              </p>
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
                  <p className="font-mono text-sm text-brand-900 leading-tight">{found.sigpacRef}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(`https://fitolink.agrom.es/sigpac/${found.sigpacRef}`)}
                    className="mt-2 text-[10px] uppercase tracking-wider font-mono text-brand-600 hover:text-brand-700"
                  >
                    Copiar enlace compartible →
                  </button>
                </div>
              </div>
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
