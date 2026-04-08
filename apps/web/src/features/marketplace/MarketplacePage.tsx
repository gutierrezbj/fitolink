import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '@/lib/api.js';
import 'leaflet/dist/leaflet.css';

type Certification = { type: string; number: string; expiry: string };
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

const SERVICE_TYPES = ['Todos', 'Aplicador', 'Multiespectral', 'Inspección'];

const COMPANY_COLORS: Record<string, string> = {
  AgroXdron: '#2563eb',
  Drovinci:  '#7c3aed',
};

function makeIcon(color: string, isSelected: boolean) {
  const size = isSelected ? 44 : 36;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="${isSelected ? 20 : 16}" fill="${color}" opacity="0.15"/>
    <circle cx="22" cy="22" r="${isSelected ? 14 : 11}" fill="${color}"/>
    <text x="22" y="27" text-anchor="middle" font-size="14" fill="white">🚁</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  if (coords) map.flyTo(coords, 10, { duration: 0.8 });
  return null;
}

function StarRating({ value, count }: { value: number; count: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(s => (
          <span key={s} className={`text-xs ${s <= Math.round(value) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
        ))}
      </div>
      <span className="text-xs text-gray-500">{value.toFixed(1)} ({count})</span>
    </div>
  );
}

function PilotCard({ pilot, selected, onClick }: { pilot: Pilot; selected: boolean; onClick: () => void }) {
  const color = pilot.company ? (COMPANY_COLORS[pilot.company] || '#354b23') : '#354b23';
  const hasApplicator = pilot.equipment.some(e => e.type.toLowerCase().includes('aplicador'));
  const hasMultispectral = pilot.equipment.some(e => e.type.toLowerCase().includes('multiespectral'));

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        selected
          ? 'border-brand-400 bg-brand-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{pilot.name}</p>
          {pilot.company && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 inline-block"
              style={{ background: color + '18', color }}
            >
              {pilot.company}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{pilot.operationalRadiusKm} km radio</p>
        </div>
      </div>

      <StarRating value={pilot.rating || 0} count={pilot.ratingCount || 0} />

      <div className="flex gap-1 mt-2 flex-wrap">
        {hasApplicator && (
          <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">💊 Aplicación</span>
        )}
        {hasMultispectral && (
          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">📡 Multiespectral</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {pilot.certifications.slice(0, 2).map((c, i) => (
          <span key={i} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
            {c.type}
          </span>
        ))}
      </div>
    </button>
  );
}

export default function MarketplacePage() {
  const [selected, setSelected] = useState<Pilot | null>(null);
  const [filter, setFilter] = useState('Todos');

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'pilots'],
    queryFn: async () => {
      const res = await api.get('/marketplace/pilots');
      return res.data.data as Pilot[];
    },
  });

  const pilots = (data || []).filter(p => p.location?.coordinates);

  const filteredPilots = pilots.filter(p => {
    if (filter === 'Todos') return true;
    if (filter === 'Aplicador') return p.equipment.some(e => e.type.toLowerCase().includes('aplicador'));
    if (filter === 'Multiespectral') return p.equipment.some(e => e.type.toLowerCase().includes('multiespectral'));
    if (filter === 'Inspección') return p.equipment.some(e => e.type.toLowerCase().includes('inspeccion') || e.type.toLowerCase().includes('inspección'));
    return true;
  });

  // Group by company
  const companies = [...new Set(pilots.map(p => p.company).filter(Boolean))] as string[];

  const flyTo: [number, number] | null = selected?.location
    ? [selected.location.coordinates[1], selected.location.coordinates[0]]
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Red de Proveedores</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {pilots.length} operadores certificados · {companies.length} empresas
          </p>
        </div>
        <div className="flex gap-1.5">
          {SERVICE_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                filter === type
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Company badges */}
      {companies.length > 0 && (
        <div className="flex gap-3 mb-4">
          {companies.map(company => {
            const color = COMPANY_COLORS[company] || '#354b23';
            const pilotCount = pilots.filter(p => p.company === company).length;
            return (
              <div
                key={company}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
                style={{ borderColor: color + '40', background: color + '08' }}
              >
                <span className="text-lg">🏢</span>
                <div>
                  <p className="text-sm font-bold" style={{ color }}>{company}</p>
                  <p className="text-[10px] text-gray-400">{pilotCount} piloto{pilotCount > 1 ? 's' : ''} · Empresa certificada FitoLink</p>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
            <span className="text-lg">🧑‍✈️</span>
            <div>
              <p className="text-sm font-bold text-gray-700">Autónomos</p>
              <p className="text-[10px] text-gray-400">{pilots.filter(p => !p.company).length} piloto{pilots.filter(p => !p.company).length !== 1 ? 's' : ''} · Certificados AESA</p>
            </div>
          </div>
        </div>
      )}

      {/* Main layout: map + list */}
      <div className="flex gap-4 flex-1 min-h-0" style={{ height: '560px' }}>
        {/* Map */}
        <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          {isLoading ? (
            <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
              <p className="text-gray-400 text-sm">Cargando mapa...</p>
            </div>
          ) : (
            <MapContainer
              center={[39.5, -4.0]}
              zoom={6}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles © Esri"
              />
              {flyTo && <FlyTo coords={flyTo} />}

              {filteredPilots.map(pilot => {
                const [lng, lat] = pilot.location!.coordinates;
                const color = pilot.company ? (COMPANY_COLORS[pilot.company] || '#354b23') : '#354b23';
                const isSelected = selected?._id === pilot._id;

                return (
                  <div key={pilot._id}>
                    <Circle
                      center={[lat, lng]}
                      radius={pilot.operationalRadiusKm * 1000}
                      pathOptions={{
                        color,
                        fillColor: color,
                        fillOpacity: isSelected ? 0.12 : 0.05,
                        weight: isSelected ? 2 : 1,
                        opacity: isSelected ? 0.6 : 0.3,
                      }}
                    />
                    <Marker
                      position={[lat, lng]}
                      icon={makeIcon(color, isSelected)}
                      eventHandlers={{ click: () => setSelected(isSelected ? null : pilot) }}
                    >
                      <Popup>
                        <div className="min-w-[160px]">
                          <p className="font-semibold text-sm">{pilot.name}</p>
                          {pilot.company && <p className="text-xs font-bold mt-0.5" style={{ color }}>{pilot.company}</p>}
                          <p className="text-xs text-gray-500 mt-1">⭐ {pilot.rating?.toFixed(1)} · {pilot.operationalRadiusKm} km radio</p>
                          <div className="mt-1.5 flex flex-col gap-0.5">
                            {pilot.equipment.map((e, i) => (
                              <p key={i} className="text-[11px] text-gray-600">• {e.model}</p>
                            ))}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  </div>
                );
              })}
            </MapContainer>
          )}
        </div>

        {/* Pilot list */}
        <div className="w-72 flex flex-col gap-2 overflow-y-auto pr-1">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
            ))
          ) : filteredPilots.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-400 text-sm">Sin operadores para este filtro</p>
            </div>
          ) : (
            filteredPilots.map(pilot => (
              <PilotCard
                key={pilot._id}
                pilot={pilot}
                selected={selected?._id === pilot._id}
                onClick={() => setSelected(selected?._id === pilot._id ? null : pilot)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
