import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Circle, GeoJSON } from 'react-leaflet';
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

// ── Compact row — used for pilots, providers and cooperatives alike ─────────
// One uniform shape: click any row to open the detail panel on the right.
// Cooperatives get a small ⚡ glyph for visual priority but no separate
// button — the action lives inside the detail view.

interface EntityRowProps {
  selected: boolean;
  onClick: () => void;
  accentColor: string;            // left vertical strip
  icon: string;                   // category svg
  title: string;
  subtitle?: string;              // company / brand
  categoryLabel: string;
  categoryBg: string;             // tailwind classes for the pill
  categoryText: string;
  rating: number;
  ratingCount: number;
  primaryStat: { label: string; value: string };  // e.g. radius or socios
  secondaryStat?: { label: string; value: string }; // e.g. equipment or area
  distance?: NearestParcel | null;
  isCoop?: boolean;
}

function EntityRow({
  selected, onClick, accentColor, icon, title, subtitle,
  categoryLabel, categoryBg, categoryText,
  rating, ratingCount, primaryStat, secondaryStat,
  distance, isCoop,
}: EntityRowProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex bg-white rounded-xl border overflow-hidden transition-all ${
        selected ? 'border-brand-400 ring-1 ring-brand-200 shadow-sm' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="w-1 flex-shrink-0" style={{ background: accentColor }} />
      <div className="flex-1 min-w-0 p-3">
        <div className="flex items-start gap-2.5">
          <img src={icon} alt="" className="w-8 h-8 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-gray-900 text-[13px] leading-snug truncate flex items-center gap-1">
                {isCoop && <span className="text-amber-500 text-[10px]">⚡</span>}
                {title}
              </p>
              <div className="flex items-center gap-1 flex-shrink-0 text-[11px] text-gray-500 tabular-nums">
                <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                <span>{rating ? rating.toFixed(1) : '—'}</span>
                <span className="text-gray-400">({ratingCount})</span>
              </div>
            </div>
            {subtitle && <p className="text-[11px] text-gray-500 truncate -mt-0.5">{subtitle}</p>}
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1.5">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${categoryBg} ${categoryText}`}>
                {categoryLabel}
              </span>
              <span className="text-[11px] text-gray-600">
                <b className="text-gray-800 tabular-nums">{primaryStat.value}</b> <span className="text-gray-400">{primaryStat.label}</span>
              </span>
              {secondaryStat && (
                <span className="text-[11px] text-gray-600">
                  <b className="text-gray-800 tabular-nums">{secondaryStat.value}</b> <span className="text-gray-400">{secondaryStat.label}</span>
                </span>
              )}
            </div>
            {distance && (
              <p className="text-[10px] text-gray-400 mt-1 truncate">
                a <b className="text-gray-600">{formatKm(distance.km)}</b> de {distance.parcelName}
              </p>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Detail panel — fires when you click a row or a marker ───────────────────
// Replaces the list inside the right column. Click "← Volver" to go back.
// Phone / email / website are clickable; for cooperatives a primary CTA
// opens the lead modal.

type DetailEntity =
  | { kind: 'pilot'; data: Pilot }
  | { kind: 'provider'; data: Provider };

interface EntityDetailProps {
  entity: DetailEntity;
  onBack: () => void;
  onRequestCoop: (provider: Provider) => void;
  distance: NearestParcel | null;
}

function EntityDetail({ entity, onBack, onRequestCoop, distance }: EntityDetailProps) {
  const isPilot = entity.kind === 'pilot';
  const pilot = isPilot ? entity.data : null;
  const provider = !isPilot ? entity.data : null;
  const isCoop = provider?.category === 'cooperative';

  const accent = isPilot
    ? getCompanyColor(pilot?.company).primary
    : CATEGORY_STYLE[(provider!.category as FilterKey)].primary;
  const icon = isPilot
    ? '/drone-pilot.svg'
    : CATEGORY_STYLE[(provider!.category as FilterKey)].icon;
  const categoryLabel = isPilot
    ? 'Piloto'
    : CATEGORY_STYLE[(provider!.category as FilterKey)].label.slice(0, -1);
  const categoryBg = isPilot ? 'bg-blue-50' : CATEGORY_STYLE[(provider!.category as FilterKey)].bg;
  const categoryText = isPilot ? 'text-blue-700' : CATEGORY_STYLE[(provider!.category as FilterKey)].text;

  const title = isPilot ? pilot!.name : provider!.name;
  const subtitle = isPilot
    ? (pilot!.company ?? 'Piloto autónomo')
    : (provider!.brand ?? null);
  const rating = (isPilot ? pilot!.rating : provider!.rating) || 0;
  const ratingCount = (isPilot ? pilot!.ratingCount : provider!.ratingCount) || 0;

  const description = !isPilot ? provider!.description : null;
  const cropSpecialties = !isPilot ? provider!.cropSpecialties : [];
  const certifications = isPilot
    ? pilot!.certifications.map(c => c.type)
    : (provider!.certifications ?? []);
  const equipment = isPilot ? pilot!.equipment : [];
  const contact = !isPilot ? provider!.contact : null;
  const radiusKm = isPilot ? pilot!.operationalRadiusKm : provider!.serviceRadiusKm;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="flex-shrink-0 border-b border-gray-100">
        <button
          onClick={onBack}
          className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
        >
          ← Volver al listado
        </button>
        <div className="h-1" style={{ background: accent }} />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* Identity */}
        <div className="flex items-start gap-3">
          <img src={icon} alt="" className="w-12 h-12 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-gray-900 text-base leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${categoryBg} ${categoryText}`}>
                {categoryLabel}
              </span>
              <Stars value={rating} count={ratingCount} />
            </div>
          </div>
        </div>

        {/* Distance / radius row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Radio</p>
            <p className="text-sm font-bold text-gray-800 tabular-nums">{radiusKm} km</p>
          </div>
          {distance ? (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tu parcela</p>
              <p className="text-sm font-bold text-gray-800 tabular-nums">{formatKm(distance.km)}</p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Verificado</p>
              <p className="text-sm font-bold text-gray-800">FitoLink ✓</p>
            </div>
          )}
        </div>

        {/* Cooperative big stats — only here, inside the detail */}
        {isCoop && (provider!.memberCount !== undefined || provider!.aggregateAreaHa !== undefined) && (
          <div className="grid grid-cols-2 gap-2">
            {provider!.memberCount !== undefined && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Socios</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{provider!.memberCount.toLocaleString('es-ES')}</p>
              </div>
            )}
            {provider!.aggregateAreaHa !== undefined && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Hectáreas</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{provider!.aggregateAreaHa.toLocaleString('es-ES')}</p>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {description && (
          <Section title="Descripción">
            <p className="text-xs text-gray-700 leading-relaxed">{description}</p>
          </Section>
        )}

        {/* Equipment (pilots) */}
        {equipment.length > 0 && (
          <Section title="Equipo">
            <ul className="space-y-1.5">
              {equipment.map((e, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 rounded-lg px-2.5 py-1.5">
                  <img src={e.type.toLowerCase().includes('multi') ? '/service-multispectral.svg' : '/service-phytosanitary.svg'} alt="" className="w-5 h-5" />
                  <span className="font-medium text-gray-800">{e.model}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500 truncate">{e.type}{e.payloadKg ? ` · ${e.payloadKg} kg` : ''}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Specialties */}
        {cropSpecialties.length > 0 && (
          <Section title="Especialidades">
            <div className="flex flex-wrap gap-1">
              {cropSpecialties.map((crop) => (
                <span key={crop} className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                  {crop}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <Section title="Certificaciones">
            <div className="flex flex-wrap gap-1">
              {certifications.map((cert, i) => (
                <span key={i} className="text-[10px] font-semibold bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  {cert}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Contact (providers) */}
        {contact && (contact.phone || contact.email || contact.website) && (
          <Section title="Contacto">
            <div className="space-y-1.5">
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-gray-700 hover:text-brand-700 hover:bg-brand-50 rounded-lg px-2.5 py-1.5 transition-colors">
                  <span className="text-gray-400">☎</span>
                  <span className="font-medium tabular-nums">{contact.phone}</span>
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-gray-700 hover:text-brand-700 hover:bg-brand-50 rounded-lg px-2.5 py-1.5 transition-colors">
                  <span className="text-gray-400">✉</span>
                  <span className="font-medium truncate">{contact.email}</span>
                </a>
              )}
              {contact.website && (
                <a href={contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-gray-700 hover:text-brand-700 hover:bg-brand-50 rounded-lg px-2.5 py-1.5 transition-colors">
                  <span className="text-gray-400">↗</span>
                  <span className="font-medium truncate">{contact.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
            </div>
          </Section>
        )}
      </div>

      {/* Sticky CTA footer */}
      {isCoop && (
        <div className="flex-shrink-0 border-t border-amber-200 bg-amber-50 p-3">
          <button
            onClick={() => onRequestCoop(provider!)}
            className="w-full bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-sm"
          >
            Solicitar contacto cooperativa →
          </button>
          <p className="text-[10px] text-center text-amber-700/80 mt-1.5">
            El equipo FitoLink te contactará en &lt; 48 h
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{title}</p>
      {children}
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

  // Filter as radio: either 'all' or one specific category. Independent
  // toggles confused users — they couldn't tell whether clicking "Pilotos"
  // was *adding* pilots to view or *isolating* them. Single-select is the
  // natural mental model: "I want to see X" or "I want to see everything".
  const [activeFilter, setActiveFilter] = useState<FilterKey | 'all'>('all');
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

  // Filter visibility — radio model. 'all' shows everything; otherwise
  // exactly one category is visible.
  const isVisible = (key: FilterKey) => activeFilter === 'all' || activeFilter === key;

  const visiblePilots = isVisible('pilot') ? pilots : [];
  const visibleProviders = providers.filter((p) => isVisible(p.category as FilterKey));

  // Resolve the currently selected entity (pilot or provider) for the detail
  // panel. Cleared on filter change so users don't see a phantom selection.
  const selectedEntity: DetailEntity | null = useMemo(() => {
    if (!selectedId) return null;
    const p = pilots.find((x) => x._id === selectedId);
    if (p) return { kind: 'pilot', data: p };
    const pr = providers.find((x) => x._id === selectedId);
    if (pr) return { kind: 'provider', data: pr };
    return null;
  }, [selectedId, pilots, providers]);

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

  const heroSubtitle = (() => {
    if (isFarmer && parcels.length > 0 && nearestOverall) {
      return (
        <>
          Directorio de pilotos, distribuidores, asesores y cooperativas en tu zona.
          {' '}El más cercano: <b className="text-gray-900">{nearestOverall.name}</b>, a {formatKm(nearestOverall.km)} de {nearestOverall.parcelName}.
        </>
      );
    }
    if (user?.role === 'pilot') return <>Directorio: {totalAll} entidades en tu zona operativa.</>;
    return <>Directorio: {totalAll} entidades certificadas en la red FitoLink.</>;
  })();

  return (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Hero */}
      <div className="flex-shrink-0 mb-3">
        <h1 className="text-2xl font-bold text-gray-900">Red FitoLink</h1>
        <p className="text-gray-500 text-sm mt-0.5">{heroSubtitle}</p>
      </div>

      {/* Category chips — radio style. One pill is always selected so you
          always know what you're looking at. The active pill fills with
          the category's brand colour; inactive pills are flat outline. */}
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0 mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mr-1">Mostrar</span>
        <button
          onClick={() => setActiveFilter('all')}
          aria-pressed={activeFilter === 'all'}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-sm font-semibold transition-all ${
            activeFilter === 'all'
              ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
          }`}
        >
          Todos
          <span className={`tabular-nums text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
            activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
          }`}>{totalAll}</span>
        </button>
        {ALL_FILTERS.map((key) => {
          const style = CATEGORY_STYLE[key];
          const active = activeFilter === key;
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-sm font-semibold transition-all ${
                active
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
              }`}
              style={active ? { backgroundColor: style.primary } : undefined}
            >
              <img src={style.icon} alt="" className={`w-4 h-4 ${active ? 'brightness-0 invert' : ''}`} />
              {style.label}
              <span className={`tabular-nums text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{counts[key]}</span>
              {key === 'cooperative' && counts[key] > 0 && (
                <span className={`text-[9px] ${active ? 'text-amber-100' : 'text-amber-500'}`}>⚡</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Map + list — fills the remaining viewport height like the other dashboards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0" style={{ minHeight: '560px' }}>
        {/* Map — 2/3 */}
        <div className="lg:col-span-2 h-full min-h-[480px]">
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm h-full">
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
                      eventHandlers={{ click: () => setSelectedId(pilot._id) }}
                    />
                    {/* Detail opens in the right panel — no native Leaflet popup */}
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
                      eventHandlers={{ click: () => setSelectedId(provider._id) }}
                    />
                    {/* Detail opens in the right panel */}
                  </div>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* Right column — list OR detail panel for the selected entity */}
        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
          {selectedEntity ? (
            <EntityDetail
              entity={selectedEntity}
              onBack={() => setSelectedId(null)}
              onRequestCoop={(p) => setLeadProvider(p)}
              distance={distanceFor.get(
                selectedEntity.kind === 'pilot' ? selectedEntity.data._id : selectedEntity.data._id,
              ) ?? null}
            />
          ) : (
            <>
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {entries.length} resultado{entries.length === 1 ? '' : 's'}
                </p>
                {isFarmer && parcels.length > 0 && (
                  <p className="text-[10px] text-gray-400">orden: cercanía a tus parcelas</p>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
                {entries.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-gray-400">No hay entidades en esta categoría.</p>
                  </div>
                ) : (
                  entries.map((entry) => {
                    if (entry.kind === 'pilot') {
                      const pilot = entry.pilot;
                      const c = getCompanyColor(pilot.company);
                      const applicator = pilot.equipment.find(e => e.type.toLowerCase().includes('aplicador'));
                      const equipDisplay = applicator?.model ?? pilot.equipment[0]?.model ?? '—';
                      return (
                        <EntityRow
                          key={pilot._id}
                          selected={selectedId === pilot._id}
                          onClick={() => setSelectedId(pilot._id)}
                          accentColor={c.primary}
                          icon="/drone-pilot.svg"
                          title={pilot.name}
                          subtitle={pilot.company || 'Piloto autónomo'}
                          categoryLabel="Piloto"
                          categoryBg="bg-blue-50"
                          categoryText="text-blue-700"
                          rating={pilot.rating || 0}
                          ratingCount={pilot.ratingCount || 0}
                          primaryStat={{ label: 'km radio', value: `${pilot.operationalRadiusKm}` }}
                          secondaryStat={equipDisplay !== '—' ? { label: '', value: equipDisplay } : undefined}
                          distance={distanceFor.get(pilot._id) ?? null}
                        />
                      );
                    }
                    const provider = entry.provider;
                    const style = CATEGORY_STYLE[provider.category as FilterKey];
                    const isCoop = provider.category === 'cooperative';
                    return (
                      <EntityRow
                        key={provider._id}
                        selected={selectedId === provider._id}
                        onClick={() => setSelectedId(provider._id)}
                        accentColor={style.primary}
                        icon={style.icon}
                        title={provider.name}
                        subtitle={provider.brand}
                        categoryLabel={style.label.slice(0, -1)}
                        categoryBg={style.bg}
                        categoryText={style.text}
                        rating={provider.rating || 0}
                        ratingCount={provider.ratingCount || 0}
                        primaryStat={
                          isCoop && provider.memberCount !== undefined
                            ? { label: 'socios', value: provider.memberCount.toLocaleString('es-ES') }
                            : { label: 'km radio', value: `${provider.serviceRadiusKm}` }
                        }
                        secondaryStat={
                          isCoop && provider.aggregateAreaHa !== undefined
                            ? { label: 'ha', value: provider.aggregateAreaHa.toLocaleString('es-ES') }
                            : undefined
                        }
                        distance={distanceFor.get(provider._id) ?? null}
                        isCoop={isCoop}
                      />
                    );
                  })
                )}
              </div>
            </>
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
