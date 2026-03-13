import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icon issue with Leaflet + Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

interface Parcel {
  _id: string;
  name: string;
  geometry: GeoJSON.Polygon;
  cropType: string;
  areaHa: number;
  ndviHistory: Array<{ mean: number; anomalyDetected: boolean }>;
}

interface ParcelMapProps {
  parcels: Parcel[];
  selectedParcelId?: string;
  onParcelClick?: (parcelId: string) => void;
  height?: string;
}

function getParcelColor(parcel: Parcel): string {
  const latestNdvi = parcel.ndviHistory?.[parcel.ndviHistory.length - 1];
  if (!latestNdvi) return '#94a3b8'; // gray
  if (latestNdvi.anomalyDetected) return '#ef4444'; // red
  if (latestNdvi.mean > 0.6) return '#22c55e'; // green
  if (latestNdvi.mean > 0.4) return '#eab308'; // yellow
  return '#f97316'; // orange
}

function FitBounds({ parcels }: { parcels: Parcel[] }) {
  const map = useMap();

  useEffect(() => {
    if (parcels.length === 0) return;
    const group = L.featureGroup(
      parcels.map((p) => L.geoJSON(p.geometry as GeoJSON.GeoJsonObject)),
    );
    map.fitBounds(group.getBounds(), { padding: [50, 50] });
  }, [map, parcels]);

  return null;
}

export default function ParcelMap({ parcels, selectedParcelId, onParcelClick, height = '500px' }: ParcelMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  // Default center: Spain
  const center: [number, number] = [39.0, -3.5];

  return (
    <MapContainer
      center={center}
      zoom={6}
      style={{ height, width: '100%' }}
      ref={mapRef}
      className="rounded-xl border border-gray-200"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds parcels={parcels} />

      {parcels.map((parcel) => (
        <GeoJSON
          key={parcel._id}
          data={parcel.geometry as GeoJSON.GeoJsonObject}
          style={{
            color: selectedParcelId === parcel._id ? '#1d4ed8' : getParcelColor(parcel),
            weight: selectedParcelId === parcel._id ? 3 : 2,
            fillOpacity: 0.3,
          }}
          eventHandlers={{
            click: () => onParcelClick?.(parcel._id),
          }}
          onEachFeature={(_feature, layer) => {
            layer.bindTooltip(
              `<b>${parcel.name}</b><br/>${parcel.cropType} · ${parcel.areaHa} ha`,
              { sticky: true },
            );
          }}
        />
      ))}
    </MapContainer>
  );
}
