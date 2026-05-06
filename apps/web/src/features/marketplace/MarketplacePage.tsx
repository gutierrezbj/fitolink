import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet';
import L from 'leaflet';
import { api } from '@/lib/api.js';
import 'leaflet/dist/leaflet.css';

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

const COMPANY_COLORS: Record<string, { primary: string; light: string; text: string }> = {
  AgroXdron: { primary: '#2563eb', light: '#eff6ff', text: '#1d4ed8' },
  Drovinci:  { primary: '#7c3aed', light: '#f5f3ff', text: '#6d28d9' },
};
const DEFAULT_COLOR = { primary: '#354b23', light: '#f0fdf4', text: '#166534' };

function getColor(company?: string) {
  return company ? (COMPANY_COLORS[company] || DEFAULT_COLOR) : DEFAULT_COLOR;
}

function makeMarkerIcon(company?: string, selected = false) {
  const c = getColor(company);
  const r = selected ? 18 : 14;
  // Stylised drone silhouette inside the marker — top-down 4-rotor outline,
  // mirrors `service-multispectral.svg` so the visual language stays unified.
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
      <span className="text-xs text-gray-500 font-medium">{value?.toFixed(1)} <span className="text-gray-400">({count})</span></span>
    </div>
  );
}

function PilotCard({ pilot, selected, onClick }: { pilot: Pilot; selected: boolean; onClick: () => void }) {
  const c = getColor(pilot.company);
  const applicator = pilot.equipment.find(e => e.type.toLowerCase().includes('aplicador'));
  const multispectral = pilot.equipment.find(e => e.type.toLowerCase().includes('multiespectral'));

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border transition-all duration-200 overflow-hidden group ${
        selected ? 'border-brand-400 shadow-lg scale-[1.01]' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      {/* Top color band */}
      <div className="h-1.5 w-full" style={{ background: c.primary }} />

      <div className="bg-white p-5">
        {/* Name + company */}
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

        {/* Rating */}
        <Stars value={pilot.rating || 0} count={pilot.ratingCount || 0} />

        {/* Equipment pills */}
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

        {/* Certs */}
        <div className="mt-3 flex flex-wrap gap-1">
          {pilot.certifications.map((cert, i) => (
            <span key={i} className="text-[9px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wide">
              {cert.type}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-gray-400">Empresa certificada FitoLink</p>
            <span className="text-xs font-semibold text-brand-600 group-hover:text-brand-700">
              {selected ? 'Ver en mapa ↑' : 'Localizar →'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function MarketplacePage() {
  const [selected, setSelected] = useState<Pilot | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'pilots'],
    queryFn: async () => {
      const res = await api.get('/marketplace/pilots');
      return res.data.data as Pilot[];
    },
  });

  const pilots = (data || []).filter(p => p.location?.coordinates);
  const companies = [...new Set(pilots.map(p => p.company).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Red de Proveedores</h1>
          <p className="text-gray-500 text-sm mt-1">
            {pilots.length} operadores certificados · {companies.length} empresas partner
          </p>
        </div>
      </div>

      {/* Company cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {companies.map(company => {
          const c = getColor(company);
          const companyPilots = pilots.filter(p => p.company === company);
          const avgRating = companyPilots.reduce((s, p) => s + (p.rating || 0), 0) / companyPilots.length;
          return (
            <div key={company} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: c.light }}>
                <img src="/company.svg" alt="" className="w-9 h-9" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{company}</p>
                <Stars value={avgRating} count={companyPilots.reduce((s, p) => s + (p.ratingCount || 0), 0)} />
                <p className="text-[11px] text-gray-400 mt-0.5">{companyPilots.length} piloto{companyPilots.length > 1 ? 's' : ''} · Partner FitoLink</p>
              </div>
              <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: c.primary }} />
            </div>
          );
        })}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <img src="/drone-pilot.svg" alt="" className="w-9 h-9" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900">Autónomos</p>
            <p className="text-xs text-gray-400 mt-0.5">Pilotos independientes</p>
            <p className="text-[11px] text-gray-400">{pilots.filter(p => !p.company).length} certificados AESA</p>
          </div>
        </div>
      </div>

      {/* Map + list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Map — 2/3 width */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '340px' }}>
            {isLoading ? (
              <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
                <p className="text-gray-400 text-sm">Cargando mapa...</p>
              </div>
            ) : (
              <MapContainer center={[39.5, -4.0]} zoom={6} style={{ width: '100%', height: '100%' }} zoomControl={true}>
                {/* Clean light map — CartoDB Positron */}
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>'
                  subdomains="abcd"
                  maxZoom={19}
                />
                {pilots.map(pilot => {
                  const [lng, lat] = pilot.location!.coordinates;
                  const c = getColor(pilot.company);
                  const isSelected = selected?._id === pilot._id;
                  return (
                    <div key={pilot._id}>
                      <Circle
                        center={[lat, lng]}
                        radius={pilot.operationalRadiusKm * 1000}
                        pathOptions={{
                          color: c.primary,
                          fillColor: c.primary,
                          fillOpacity: isSelected ? 0.10 : 0.04,
                          weight: isSelected ? 2 : 1,
                          opacity: isSelected ? 0.7 : 0.25,
                          dashArray: isSelected ? undefined : '6 4',
                        }}
                      />
                      <Marker
                        position={[lat, lng]}
                        icon={makeMarkerIcon(pilot.company, isSelected)}
                        eventHandlers={{ click: () => setSelected(isSelected ? null : pilot) }}
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
                            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <svg width="11" height="11" viewBox="0 0 20 20" fill="#fbbf24"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                              {pilot.rating?.toFixed(1)} · {pilot.operationalRadiusKm} km radio
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
              </MapContainer>
            )}
          </div>
        </div>

        {/* Pilot list — 1/3 width */}
        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: '340px' }}>
          {isLoading
            ? [...Array(2)].map((_, i) => <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />)
            : pilots.map(pilot => (
                <PilotCard
                  key={pilot._id}
                  pilot={pilot}
                  selected={selected?._id === pilot._id}
                  onClick={() => setSelected(selected?._id === pilot._id ? null : pilot)}
                />
              ))
          }
        </div>
      </div>
    </div>
  );
}
