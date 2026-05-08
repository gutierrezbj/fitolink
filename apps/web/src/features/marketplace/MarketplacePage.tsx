import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Circle, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import { toast } from '@/stores/toastStore.js';
import { distanceKm, polygonCentroid, findNearestParcel, formatKm, type NearestParcel } from './distance.js';
import 'leaflet/dist/leaflet.css';

// ── Types ────────────────────────────────────────────────────────────────────

type Certification = { type: string };
type Equipment = { model: string; type: string; payloadKg?: number };

type Pilot = {
  _id: string;
  name: string;
  company?: string;
  rating: number;
  ratingCount: number;
  operationalRadiusKm: number;
  certifications: Certification[];
  equipment: Equipment[];
  location?: { type: string; coordinates: [number, number] };
};

type ProviderCategory = 'phyto-distributor' | 'agronomist' | 'cooperative';

type Provider = {
  _id: string;
  category: ProviderCategory;
  name: string;
  brand?: string;
  description: string;
  location: { type: 'Point'; coordinates: [number, number] };
  serviceRadiusKm: number;
  cropSpecialties: string[];
  contact: { email?: string; phone?: string; website?: string };
  certifications?: string[];
  rating: number;
  ratingCount: number;
  isVerified: boolean;
  notes?: string;
  memberCount?: number;
  aggregateAreaHa?: number;
};

type Parcel = {
  _id: string;
  name: string;
  geometry: GeoJSON.Polygon;
  cropType: string;
};

type FilterKey = 'pilot' | 'phyto-distributor' | 'agronomist' | 'cooperative';

// ── Visual config per category ───────────────────────────────────────────────

const COMPANY_COLORS: Record<string, { primary: string; light: string; text: string }> = {
  AgroXdron: { primary: '#2563eb', light: '#eff6ff', text: '#1d4ed8' },
  Drovinci:  { primary: '#7c3aed', light: '#f5f3ff', text: '#6d28d9' },
};
const PILOT_DEFAULT = { primary: '#354b23', light: '#f0fdf4', text: '#166534' };

// Each category gets its own marker / pill colour. Reused everywhere.
const CATEGORY_STYLE: Record<FilterKey, {
  label: string;
  primary: string;
  bg: string;
  text: string;
  ring: string;
  icon: string;
}> = {
  'pilot':              { label: 'Pilotos',         primary: '#2563eb', bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-200',   icon: '/drone-pilot.svg' },
  'phyto-distributor':  { label: 'Distribuidores',  primary: '#c2410c', bg: 'bg-orange-50',  text: 'text-orange-700',  ring: 'ring-orange-200', icon: '/provider-distributor.svg' },
  'agronomist':         { label: 'Asesores',        primary: '#65a30d', bg: 'bg-lime-50',    text: 'text-lime-700',    ring: 'ring-lime-200',   icon: '/provider-advisor.svg' },
  'cooperative':        { label: 'Cooperativas',    primary: '#a16207', bg: 'bg-amber-50',   text: 'text-amber-800',   ring: 'ring-amber-200',  icon: '/provider-cooperative.svg' },
};

const ALL_FILTERS: FilterKey[] = ['pilot', 'phyto-distributor', 'agronomist', 'cooperative'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCompanyColor(company?: string) {
  return company ? (COMPANY_COLORS[company] || PILOT_DEFAULT) : PILOT_DEFAULT;
}

function makePilotMarker(company: string | undefined, selected = false) {
  const c = getCompanyColor(company);
  const r = selected ? 18 : 14;
  const arm = r * 0.55;
  const rotor = r * 0.28;
  const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${r*3}" height="${r*3}" viewBox="0 0 ${r*3} ${r*3}">
    <circle cx="${r*1.5}" cy="${r*1.5}" r="${r*1.4}" fill="${c.primary}" opacity="0.18"/>
    <circle cx="${r*1.5}" cy="${r*1.5}" r="${r}" fill="${c.primary}" stroke="white" stroke-width="2.5"/>
    <g stroke="white" stroke-width="1.4" stroke-linecap="round" fill="none">
      <line x1="${r*1.5 - arm}" y1="${r*1.5 - arm}" x2="${r*1.5 + arm}" y2="${r*1.5 + arm}"/>
      <line x1="${r*1.5 + arm}" y1="${r*1.5 - arm}" x2="${r*1.5 - arm}" y2="${r*1.5 + arm}"/>
    </g>
    <g fill="white">
      <circle cx="${r*1.5 - arm}" cy="${r*1.5 - arm}" r="${rotor}"/>
      <circle cx="${r*1.5 + arm}" cy="${r*1.5 - arm}" r="${rotor}"/>
      <circle cx="${r*1.5 - arm}" cy="${r*1.5 + arm}" r="${rotor}"/>
      <circle cx="${r*1.5 + arm}" cy="${r*1.5 + arm}" r="${rotor}"/>
    </g>
    <circle cx="${r*1.5}" cy="${r*1.5}" r="${rotor*0.7}" fill="${c.primary}" stroke="white" stroke-width="0.8"/>
  </svg>`);
  const size = r * 3;
  return L.divIcon({
    html: `<img src="data:image/svg+xml,${svg}" width="${size}" height="${size}"/>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Marker used for the non-pilot categories — coloured ring with a glyph hint. */
function makeProviderMarker(category: ProviderCategory, selected = false) {
  const style = CATEGORY_STYLE[category];
  const r = selected ? 18 : 14;
  const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${r*3}" height="${r*3}" viewBox="0 0 ${r*3} ${r*3}">
    <circle cx="${r*1.5}" cy="${r*1.5}" r="${r*1.4}" fill="${style.primary}" opacity="0.18"/>
    <circle cx="${r*1.5}" cy="${r*1.5}" r="${r}" fill="${style.primary}" stroke="white" stroke-width="2.5"/>
    <circle cx="${r*1.5}" cy="${r*1.5}" r="${r*0.42}" fill="white"/>
  </svg>`);
  const size = r * 3;
  return L.divIcon({
    html: `<img src="data:image/svg+xml,${svg}" width="${size}" height="${size}"/>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function Stars({ value, count }: { value: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(s => (
          <svg key={s} className={`w-3 h-3 ${s <= Math.round(value) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        ))}
      </div>
      <span className="text-xs text-gray-500 font-medium">
        {value ? value.toFixed(1) : '—'} <span className="text-gray-400">({count})</span>
      </span>
    </div>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────────

function PilotCard({ pilot, selected, onClick, distance }: {
  pilot: Pilot;
  selected: boolean;
  onClick: () => void;
  distance: NearestParcel | null;
}) {
  const c = getCompanyColor(pilot.company);
  const applicator = pilot.equipment.find(e => e.type.toLowerCase().includes('aplicador'));
  const multispectral = pilot.equipment.find(e => e.type.toLowerCase().includes('multiespectral'));
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border transition-all duration-200 overflow-hidden group ${
        selected ? 'border-brand-400 shadow-lg scale-[1.01]' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      <div className="h-1.5 w-full" style={{ background: c.primary }} />
      <div className="bg-white p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-bold text-gray-900 text-[15px] leading-tight">{pilot.name}</p>
            {pilot.company ? (
              <span className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                style={{ background: c.light, color: c.text }}>
                <img src="/company.svg" alt="" className="w-3.5 h-3.5" />
                {pilot.company}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                <img src="/drone-pilot.svg" alt="" className="w-3.5 h-3.5" />
                Autónomo
              </span>
            )}
          </div>
          <div className="text-right mt-0.5">
            <p className="text-xs font-bold text-gray-700">{pilot.operationalRadiusKm} km</p>
            <p className="text-[10px] text-gray-400">radio op.</p>
          </div>
        </div>
        <Stars value={pilot.rating || 0} count={pilot.ratingCount || 0} />
        <div className="mt-3 space-y-1.5">
          {applicator && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5">
              <img src="/service-phytosanitary.svg" alt="" className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-green-800">{applicator.model}</p>
                <p className="text-[10px] text-green-600">Aplicación fitosanitaria{applicator.payloadKg ? ` · ${applicator.payloadKg}kg` : ''}</p>
              </div>
            </div>
          )}
          {multispectral && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
              <img src="/service-multispectral.svg" alt="" className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-blue-800">{multispectral.model}</p>
                <p className="text-[10px] text-blue-600">Inspección multiespectral</p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {pilot.certifications.map((cert, i) => (
            <span key={i} className="text-[9px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wide">
              {cert.type}
            </span>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[11px] text-gray-400">
            {distance ? <>a <b className="text-gray-700">{formatKm(distance.km)}</b> de {distance.parcelName}</> : 'Empresa certificada FitoLink'}
          </p>
          <span className="text-xs font-semibold text-brand-600 group-hover:text-brand-700">
            {selected ? 'Ver en mapa ↑' : 'Localizar →'}
          </span>
        </div>
      </div>
    </button>
  );
}

function ProviderCard({ provider, selected, onClick, distance }: {
  provider: Provider;
  selected: boolean;
  onClick: () => void;
  distance: NearestParcel | null;
}) {
  const style = CATEGORY_STYLE[provider.category];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border transition-all duration-200 overflow-hidden group ${
        selected ? 'border-brand-400 shadow-lg scale-[1.01]' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      <div className="h-1.5 w-full" style={{ background: style.primary }} />
      <div className="bg-white p-5">
        <div className="flex items-start gap-3 mb-3">
          <img src={style.icon} alt="" className="w-10 h-10 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 text-[15px] leading-tight truncate">{provider.name}</p>
            {provider.brand && (
              <p className="text-[11px] text-gray-500 truncate">{provider.brand}</p>
            )}
            <span className={`inline-flex mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
              {style.label.slice(0, -1)}
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-700">{provider.serviceRadiusKm} km</p>
            <p className="text-[10px] text-gray-400">radio</p>
          </div>
        </div>
        <p className="text-[12px] text-gray-600 leading-relaxed mb-3">{provider.description}</p>
        <Stars value={provider.rating || 0} count={provider.ratingCount || 0} />
        {provider.cropSpecialties.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {provider.cropSpecialties.slice(0, 5).map((crop) => (
              <span key={crop} className="text-[10px] bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                {crop}
              </span>
            ))}
          </div>
        )}
        {provider.certifications && provider.certifications.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {provider.certifications.slice(0, 3).map((cert, i) => (
              <span key={i} className="text-[9px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wide">
                {cert}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[11px] text-gray-400">
            {distance ? <>a <b className="text-gray-700">{formatKm(distance.km)}</b> de {distance.parcelName}</> : 'Proveedor certificado'}
          </p>
          <span className="text-xs font-semibold text-brand-600 group-hover:text-brand-700">
            Contactar →
          </span>
        </div>
      </div>
    </button>
  );
}

function CooperativeCard({ provider, selected, onClick, onRequestProgram, distance }: {
  provider: Provider;
  selected: boolean;
  onClick: () => void;
  onRequestProgram: () => void;
  distance: NearestParcel | null;
}) {
  const style = CATEGORY_STYLE['cooperative'];
  return (
    <div
      className={`rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
        selected ? 'border-amber-500 shadow-lg' : 'border-amber-200 hover:border-amber-400 hover:shadow-md'
      }`}
    >
      {/* Highlight band: cooperative is strategic */}
      <div className="bg-gradient-to-r from-amber-700 to-amber-500 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={style.icon} alt="" className="w-5 h-5" />
          <span className="text-[10px] font-bold text-white tracking-widest uppercase">Programa cooperativa</span>
        </div>
        <span className="text-[9px] text-white/80 font-medium">Cliente potencial estratégico</span>
      </div>
      <button
        onClick={onClick}
        className="w-full text-left bg-amber-50 hover:bg-amber-100 transition-colors p-5"
      >
        <div className="flex items-start gap-3 mb-3">
          <img src={style.icon} alt="" className="w-12 h-12 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 text-base leading-tight">{provider.name}</p>
            {provider.brand && <p className="text-xs text-amber-800 font-semibold">{provider.brand}</p>}
            <Stars value={provider.rating || 0} count={provider.ratingCount || 0} />
          </div>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed mb-4">{provider.description}</p>
        {/* Big stats — what makes a coop a strategic target */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {provider.memberCount !== undefined && (
            <div className="bg-white rounded-xl border border-amber-100 p-3">
              <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Socios</p>
              <p className="text-2xl font-bold text-gray-900 leading-tight">{provider.memberCount.toLocaleString('es-ES')}</p>
            </div>
          )}
          {provider.aggregateAreaHa !== undefined && (
            <div className="bg-white rounded-xl border border-amber-100 p-3">
              <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Hectáreas</p>
              <p className="text-2xl font-bold text-gray-900 leading-tight">{provider.aggregateAreaHa.toLocaleString('es-ES')}</p>
            </div>
          )}
        </div>
        {provider.cropSpecialties.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {provider.cropSpecialties.map((crop) => (
              <span key={crop} className="text-[10px] bg-amber-100 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                {crop}
              </span>
            ))}
          </div>
        )}
        {distance && (
          <p className="text-[11px] text-gray-500">a <b className="text-gray-700">{formatKm(distance.km)}</b> de {distance.parcelName}</p>
        )}
      </button>
      {/* Strategic CTA — separate from the card body so it's not part of the toggle action */}
      <div className="bg-amber-50 border-t border-amber-200 px-5 py-3">
        <button
          onClick={onRequestProgram}
          className="w-full bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-sm"
        >
          Solicitar programa cooperativa →
        </button>
      </div>
    </div>
  );
}

// ── Cooperative lead modal ───────────────────────────────────────────────────

function CooperativeLeadModal({ provider, onClose }: {
  provider: Provider;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const [message, setMessage] = useState('');
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/marketplace/leads', {
        providerId: provider._id,
        type: 'cooperative-program',
        message: message.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Solicitud enviada · te contactará el equipo FitoLink');
      onClose();
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } }; message?: string }) => {
      const msg = e.response?.data?.error?.message ?? e.message ?? 'No se ha podido enviar la solicitud';
      toast.error(msg);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-amber-700 to-amber-500 px-5 py-3 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/provider-cooperative.svg" alt="" className="w-6 h-6" />
            <span className="text-white text-sm font-bold">Programa cooperativa</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5">
          <h2 className="font-bold text-gray-900 text-lg">{provider.name}</h2>
          <p className="text-sm text-gray-500 mb-4">{provider.brand}</p>
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
            Solicitas información sobre el programa FitoLink para cooperativas.
            El equipo te contactará en menos de 48 h con condiciones, precios y un plan piloto adaptado.
          </p>
          <div className="bg-gray-50 rounded-xl p-3 mb-4 text-[11px] text-gray-600 space-y-0.5">
            <p>Solicitante: <b className="text-gray-900">{user?.name}</b></p>
            <p>Email: <b className="text-gray-900">{user?.email}</b></p>
            <p>Rol: <b className="text-gray-900">{user?.role}</b></p>
          </div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Mensaje (opcional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Cuéntanos qué buscas (nº parcelas, cultivos, calendario, presupuesto)…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none"
            disabled={mutation.isPending}
          />
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={onClose}
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50"
            >
              {mutation.isPending ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { user } = useAuthStore();
  const isFarmer = user?.role === 'farmer';

  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set(ALL_FILTERS));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leadProvider, setLeadProvider] = useState<Provider | null>(null);

  const { data: pilotsData } = useQuery({
    queryKey: ['marketplace', 'pilots'],
    queryFn: async () => {
      const res = await api.get('/marketplace/pilots');
      return res.data.data as Pilot[];
    },
  });

  const { data: providersData } = useQuery({
    queryKey: ['marketplace', 'providers'],
    queryFn: async () => {
      const res = await api.get('/marketplace/providers');
      return res.data.data as Provider[];
    },
  });

  const { data: parcelsData } = useQuery({
    queryKey: ['parcels', 'mine'],
    queryFn: async () => {
      const res = await api.get('/parcels/mine');
      return res.data.data as Parcel[];
    },
    enabled: isFarmer,
  });

  const pilots = useMemo(() => (pilotsData || []).filter((p) => p.location?.coordinates), [pilotsData]);
  const providers = useMemo(() => (providersData || []).filter((p) => p.location?.coordinates), [providersData]);
  const parcels = parcelsData || [];

  // Counts per filter — always show TOTAL counts, not filtered, so the user
  // sees how many entries each chip represents.
  const counts: Record<FilterKey, number> = {
    'pilot': pilots.length,
    'phyto-distributor': providers.filter((p) => p.category === 'phyto-distributor').length,
    'agronomist': providers.filter((p) => p.category === 'agronomist').length,
    'cooperative': providers.filter((p) => p.category === 'cooperative').length,
  };
  const totalAll = counts.pilot + counts['phyto-distributor'] + counts.agronomist + counts.cooperative;

  // Distance map for every entity, computed against the farmer's parcels.
  // Pilots and Providers share the same lookup space: their `location.coordinates`.
  const distanceFor = useMemo(() => {
    const map = new Map<string, NearestParcel | null>();
    if (!parcels.length) return map;
    for (const p of pilots) {
      if (!p.location?.coordinates) continue;
      map.set(p._id, findNearestParcel(p.location.coordinates, parcels));
    }
    for (const p of providers) {
      map.set(p._id, findNearestParcel(p.location.coordinates, parcels));
    }
    return map;
  }, [pilots, providers, parcels]);

  // Hero: most-near entity overall
  const nearestOverall = useMemo(() => {
    if (!parcels.length) return null;
    let best: { name: string; km: number; parcelName: string } | null = null;
    for (const [, dist] of distanceFor) {
      if (dist && (!best || dist.km < best.km)) {
        const entity =
          pilots.find((pi) => distanceFor.get(pi._id) === dist) ||
          providers.find((pr) => distanceFor.get(pr._id) === dist);
        if (entity) {
          best = { name: entity.name, km: dist.km, parcelName: dist.parcelName };
        }
      }
    }
    return best;
  }, [distanceFor, pilots, providers, parcels]);

  // Filter visibility
  const isVisible = (key: FilterKey) => activeFilters.has(key);

  const visiblePilots = isVisible('pilot') ? pilots : [];
  const visibleProviders = providers.filter((p) =>
    activeFilters.has(p.category as FilterKey),
  );

  // Combined cards list, sorted by distance to nearest parcel (or rating if no parcels).
  type Entry = { kind: 'pilot'; pilot: Pilot } | { kind: 'provider'; provider: Provider };
  const entries: Entry[] = [
    ...visiblePilots.map((pilot) => ({ kind: 'pilot' as const, pilot })),
    ...visibleProviders.map((provider) => ({ kind: 'provider' as const, provider })),
  ];

  entries.sort((a, b) => {
    const idA = a.kind === 'pilot' ? a.pilot._id : a.provider._id;
    const idB = b.kind === 'pilot' ? b.pilot._id : b.provider._id;
    const dA = distanceFor.get(idA)?.km;
    const dB = distanceFor.get(idB)?.km;
    if (dA !== undefined && dB !== undefined) return dA - dB;
    if (dA !== undefined) return -1;
    if (dB !== undefined) return 1;
    // Cooperatives bubble up when no distance is known — they're the strategic CTA
    const aIsCoop = a.kind === 'provider' && a.provider.category === 'cooperative';
    const bIsCoop = b.kind === 'provider' && b.provider.category === 'cooperative';
    if (aIsCoop && !bIsCoop) return -1;
    if (bIsCoop && !aIsCoop) return 1;
    const ratingA = a.kind === 'pilot' ? a.pilot.rating : a.provider.rating;
    const ratingB = b.kind === 'pilot' ? b.pilot.rating : b.provider.rating;
    return (ratingB || 0) - (ratingA || 0);
  });

  const toggleFilter = (key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (next.size === 0) ALL_FILTERS.forEach((f) => next.add(f)); // never empty
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const heroSubtitle = (() => {
    if (isFarmer && parcels.length > 0 && nearestOverall) {
      return (
        <>
          {totalAll} proveedores certificados cerca de tus {parcels.length} parcela{parcels.length !== 1 ? 's' : ''}.
          {' '}El más cercano: <b className="text-gray-900">{nearestOverall.name}</b> a {formatKm(nearestOverall.km)} de {nearestOverall.parcelName}.
        </>
      );
    }
    if (user?.role === 'pilot') return <>Tu red operativa: {totalAll} entidades en zona</>;
    return <>{totalAll} entidades certificadas en la red FitoLink</>;
  })();

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Red FitoLink</h1>
        <p className="text-gray-500 text-sm mt-1">{heroSubtitle}</p>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFilters(new Set(ALL_FILTERS))}
          className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
            activeFilters.size === ALL_FILTERS.length
              ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
          }`}
        >
          Todos · {totalAll}
        </button>
        {ALL_FILTERS.map((key) => {
          const style = CATEGORY_STYLE[key];
          const active = isVisible(key);
          return (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                active ? `${style.bg} ${style.text} border-current shadow-sm ring-1 ${style.ring}`
                       : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 opacity-60'
              }`}
            >
              <img src={style.icon} alt="" className="w-4 h-4" />
              {style.label} · {counts[key]}
              {key === 'cooperative' && counts[key] > 0 && (
                <span className="ml-1 text-[9px]">⚡</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Map + cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Map — 2/3 */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '480px' }}>
            <MapContainer center={[39.5, -4.0]} zoom={6} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>'
                subdomains="abcd"
                maxZoom={19}
              />

              {/* Farmer's parcels in green */}
              {isFarmer && parcels.map((parcel) => (
                <GeoJSON
                  key={parcel._id}
                  data={parcel.geometry}
                  style={{ color: '#16a34a', weight: 2, fillColor: '#bbf7d0', fillOpacity: 0.45 }}
                />
              ))}

              {/* Pilots */}
              {visiblePilots.map((pilot) => {
                if (!pilot.location?.coordinates) return null;
                const [lng, lat] = pilot.location.coordinates;
                const c = getCompanyColor(pilot.company);
                const isSelected = selectedId === pilot._id;
                return (
                  <div key={pilot._id}>
                    <Circle
                      center={[lat, lng]}
                      radius={pilot.operationalRadiusKm * 1000}
                      pathOptions={{
                        color: c.primary, fillColor: c.primary,
                        fillOpacity: isSelected ? 0.10 : 0.04,
                        weight: isSelected ? 2 : 1,
                        opacity: isSelected ? 0.7 : 0.25,
                        dashArray: isSelected ? undefined : '6 4',
                      }}
                    />
                    <Marker
                      position={[lat, lng]}
                      icon={makePilotMarker(pilot.company, isSelected)}
                      eventHandlers={{ click: () => setSelectedId(isSelected ? null : pilot._id) }}
                    >
                      <Popup className="pilot-popup">
                        <div style={{ minWidth: 180 }}>
                          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{pilot.name}</p>
                          {pilot.company && (
                            <p style={{ fontSize: 11, fontWeight: 700, color: c.primary, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <img src="/company.svg" alt="" style={{ width: 14, height: 14 }} />
                              {pilot.company}
                            </p>
                          )}
                          <p style={{ fontSize: 11, color: '#6b7280' }}>
                            {pilot.rating?.toFixed(1)} ★ · {pilot.operationalRadiusKm} km radio
                          </p>
                          {pilot.equipment.map((e, i) => (
                            <p key={i} style={{ fontSize: 11, color: '#374151', marginBottom: 1 }}>• {e.model}</p>
                          ))}
                        </div>
                      </Popup>
                    </Marker>
                  </div>
                );
              })}

              {/* Providers */}
              {visibleProviders.map((provider) => {
                const [lng, lat] = provider.location.coordinates;
                const isSelected = selectedId === provider._id;
                const style = CATEGORY_STYLE[provider.category as FilterKey];
                return (
                  <div key={provider._id}>
                    <Circle
                      center={[lat, lng]}
                      radius={provider.serviceRadiusKm * 1000}
                      pathOptions={{
                        color: style.primary, fillColor: style.primary,
                        fillOpacity: isSelected ? 0.10 : 0.04,
                        weight: isSelected ? 2 : 1,
                        opacity: isSelected ? 0.6 : 0.2,
                        dashArray: isSelected ? undefined : '6 4',
                      }}
                    />
                    <Marker
                      position={[lat, lng]}
                      icon={makeProviderMarker(provider.category, isSelected)}
                      eventHandlers={{ click: () => setSelectedId(isSelected ? null : provider._id) }}
                    >
                      <Popup>
                        <div style={{ minWidth: 200 }}>
                          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{provider.name}</p>
                          <p style={{ fontSize: 11, fontWeight: 700, color: style.primary, marginBottom: 6 }}>
                            {style.label.slice(0, -1)}{provider.brand ? ` · ${provider.brand}` : ''}
                          </p>
                          <p style={{ fontSize: 11, color: '#374151', marginBottom: 4 }}>{provider.description}</p>
                          {provider.category === 'cooperative' && provider.memberCount && (
                            <p style={{ fontSize: 11, color: '#a16207', fontWeight: 600 }}>
                              {provider.memberCount.toLocaleString('es-ES')} socios · {provider.aggregateAreaHa?.toLocaleString('es-ES')} ha
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  </div>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* Cards — 1/3, scrollable internally */}
        <div className="space-y-3 overflow-y-auto pr-1" style={{ maxHeight: '480px' }}>
          {entries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">No hay entidades visibles con los filtros activos.</p>
            </div>
          ) : (
            entries.map((entry) => {
              if (entry.kind === 'pilot') {
                return (
                  <PilotCard
                    key={entry.pilot._id}
                    pilot={entry.pilot}
                    selected={selectedId === entry.pilot._id}
                    onClick={() => setSelectedId(selectedId === entry.pilot._id ? null : entry.pilot._id)}
                    distance={distanceFor.get(entry.pilot._id) ?? null}
                  />
                );
              }
              if (entry.provider.category === 'cooperative') {
                return (
                  <CooperativeCard
                    key={entry.provider._id}
                    provider={entry.provider}
                    selected={selectedId === entry.provider._id}
                    onClick={() => setSelectedId(selectedId === entry.provider._id ? null : entry.provider._id)}
                    onRequestProgram={() => setLeadProvider(entry.provider)}
                    distance={distanceFor.get(entry.provider._id) ?? null}
                  />
                );
              }
              return (
                <ProviderCard
                  key={entry.provider._id}
                  provider={entry.provider}
                  selected={selectedId === entry.provider._id}
                  onClick={() => setSelectedId(selectedId === entry.provider._id ? null : entry.provider._id)}
                  distance={distanceFor.get(entry.provider._id) ?? null}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Cooperative lead modal */}
      {leadProvider && (
        <CooperativeLeadModal
          provider={leadProvider}
          onClose={() => setLeadProvider(null)}
        />
      )}
    </div>
  );
}
