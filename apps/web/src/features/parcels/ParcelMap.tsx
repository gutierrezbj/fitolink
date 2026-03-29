import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

interface NdviReading {
  mean: number;
  anomalyDetected: boolean;
  date?: string;
}

interface Parcel {
  _id: string;
  name: string;
  geometry: GeoJSON.Polygon;
  cropType: string;
  areaHa: number;
  province?: string;
  ndviHistory: NdviReading[];
}

interface ParcelMapProps {
  parcels: Parcel[];
  selectedParcelId?: string;
  onParcelClick?: (parcelId: string) => void;
  height?: string;
  showDetailLink?: boolean;
}

function getParcelColor(parcel: Parcel): string {
  const latest = parcel.ndviHistory?.[parcel.ndviHistory.length - 1];
  if (!latest) return '#94a3b8';
  if (latest.anomalyDetected || latest.mean < 0.30) return '#ef4444';
  if (latest.mean < 0.40) return '#f97316';
  if (latest.mean < 0.55) return '#eab308';
  return '#22c55e';
}

function getHealthLabel(ndvi: number): string {
  if (ndvi >= 0.55) return 'Saludable';
  if (ndvi >= 0.40) return 'Atencion';
  if (ndvi >= 0.30) return 'Riesgo';
  return 'Critico';
}

function getPolygonCenter(geometry: GeoJSON.Polygon): [number, number] {
  const coords = geometry.coordinates[0];
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  return [lat, lng];
}

function FitBounds({ parcels }: { parcels: Parcel[] }) {
  const map = useMap();
  useEffect(() => {
    if (parcels.length === 0) return;
    const group = L.featureGroup(parcels.map((p) => L.geoJSON(p.geometry as GeoJSON.GeoJsonObject)));
    map.fitBounds(group.getBounds(), { padding: [40, 40] });
  }, [map, parcels]);
  return null;
}

function AlertPulse({ parcel }: { parcel: Parcel }) {
  const center = getPolygonCenter(parcel.geometry);
  return (
    <>
      <CircleMarker
        center={center}
        radius={14}
        pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 1, dashArray: '4 2' }}
      />
      <CircleMarker
        center={center}
        radius={6}
        pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.8, weight: 2 }}
      />
    </>
  );
}

function ParcelLayer({ parcel, isSelected, onParcelClick, showDetailLink }: {
  parcel: Parcel;
  isSelected: boolean;
  onParcelClick?: (id: string) => void;
  showDetailLink?: boolean;
}) {
  const latest = parcel.ndviHistory?.[parcel.ndviHistory.length - 1];
  const color = getParcelColor(parcel);
  const hasAlert = latest?.anomalyDetected || (latest && latest.mean < 0.3);

  const popupHtml = `
    <div style="min-width:180px;font-family:Inter,system-ui,sans-serif">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <b style="font-size:13px;color:#111">${parcel.name}</b>
        ${hasAlert ? '<span style="background:#fef2f2;color:#ef4444;font-size:10px;padding:2px 6px;border-radius:20px;font-weight:600">⚠ Alerta</span>' : ''}
      </div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:8px">
        ${parcel.cropType}${parcel.province ? ' · ' + parcel.province : ''} · ${parcel.areaHa} ha
      </div>
      ${latest ? `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#f9fafb;border-radius:8px;margin-bottom:8px">
          <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
          <div>
            <div style="font-size:13px;font-weight:700;color:${color}">${latest.mean.toFixed(3)}</div>
            <div style="font-size:10px;color:#9ca3af">${getHealthLabel(latest.mean)}</div>
          </div>
        </div>
      ` : '<div style="font-size:11px;color:#9ca3af;margin-bottom:8px">Sin datos NDVI</div>'}
      ${showDetailLink ? `<a href="/dashboard/parcels/${parcel._id}" style="display:block;text-align:center;background:#16a34a;color:#fff;text-decoration:none;font-size:11px;font-weight:600;padding:5px 10px;border-radius:6px">Ver detalle →</a>` : ''}
    </div>
  `;

  return (
    <GeoJSON
      key={parcel._id}
      data={parcel.geometry as GeoJSON.GeoJsonObject}
      style={{
        color: isSelected ? '#1d4ed8' : color,
        weight: isSelected ? 3 : 2,
        fillColor: color,
        fillOpacity: isSelected ? 0.45 : 0.3,
      }}
      eventHandlers={{
        click: () => onParcelClick?.(parcel._id),
      }}
      onEachFeature={(_feature, layer) => {
        layer.bindPopup(popupHtml, { maxWidth: 240, className: 'fitolink-popup' });
        layer.bindTooltip(`<b>${parcel.name}</b>`, { sticky: true, direction: 'top', offset: [0, -5] });
      }}
    />
  );
}

export default function ParcelMap({
  parcels,
  selectedParcelId,
  onParcelClick,
  height = '500px',
  showDetailLink = false,
}: ParcelMapProps) {
  const alertParcels = parcels.filter((p) => {
    const latest = p.ndviHistory?.[p.ndviHistory.length - 1];
    return latest?.anomalyDetected || (latest && latest.mean < 0.3);
  });

  return (
    <MapContainer
      center={[39.0, -3.5]}
      zoom={6}
      style={{ height, width: '100%' }}
      className="rounded-xl border border-gray-200"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds parcels={parcels} />

      {parcels.map((parcel) => (
        <ParcelLayer
          key={parcel._id}
          parcel={parcel}
          isSelected={selectedParcelId === parcel._id}
          onParcelClick={onParcelClick}
          showDetailLink={showDetailLink}
        />
      ))}

      {alertParcels.map((parcel) => (
        <AlertPulse key={`pulse-${parcel._id}`} parcel={parcel} />
      ))}
    </MapContainer>
  );
}
