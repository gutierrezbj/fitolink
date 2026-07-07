import { useEffect, useRef } from 'react';
import type React from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { ndviColor, ndviHealthLabel, ndviLowForCrop } from '@/lib/cropHealth.js';
import { cropLabel } from '@fitolink/shared';

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
  // ParcelMap acepta 2 shapes de datos NDVI:
  //  · ndviHistory[] · shape COMPLETO de /parcels/mine (con historial)
  //  · ndvi + hasActiveAlert · shape AGREGADO de /cooperative/overview
  //    (solo última lectura + flag de alerta, usado en dashboards Coop/
  //    ADV/Regantes que muestran cartera agregada de socios)
  // Fix 05-jun-2026 · antes los dashboards agregados usaban `as any` cast
  // y todas las parcelas renderizaban en gris fallback porque ndviHistory
  // estaba undefined. Ahora getParcelColor prioriza ndvi directo si existe.
  ndviHistory?: NdviReading[];
  ndvi?: number | null;
  hasActiveAlert?: boolean;
  ownerName?: string;
}

interface ParcelMapProps {
  parcels: Parcel[];
  selectedParcelId?: string;
  focusParcelId?: string;
  onParcelClick?: (parcelId: string) => void;
  height?: string;
  showDetailLink?: boolean;
  showLegend?: boolean;
  mapStyle?: 'satellite' | 'light';
  /** 'estado' = color por salud NDVI (con alertas); 'cultivo' = color por cultivo. */
  colorMode?: 'estado' | 'cultivo';
  children?: React.ReactNode;
}

// Helpers que normalizan el shape NDVI dual (ndvi directo vs ndviHistory[])
// — ver comentario en interface Parcel arriba.

function getLatestNdvi(parcel: Parcel): number | null {
  if (parcel.ndvi !== undefined && parcel.ndvi !== null) return parcel.ndvi;
  const last = parcel.ndviHistory?.[parcel.ndviHistory.length - 1];
  return last?.mean ?? null;
}

function hasAlertOnParcel(parcel: Parcel): boolean {
  if (parcel.hasActiveAlert !== undefined) return parcel.hasActiveAlert;
  const last = parcel.ndviHistory?.[parcel.ndviHistory.length - 1];
  if (!last) return false;
  // Alerta solo si está bajo PARA SU CULTIVO (olivar de secano vive en 0.2–0.4).
  return last.anomalyDetected || ndviLowForCrop(last.mean, parcel.cropType);
}

// Color por CULTIVO para el modo "Cultivo" del mapa. Familia coherente con los
// chips de la lista; tono -600 para buen contraste sobre satélite.
const CROP_HEX: Record<string, string> = {
  maiz: '#d97706', cereal: '#ca8a04', olivo: '#16a34a', leguminosa: '#65a30d',
  girasol: '#d97706', citrico: '#ea580c', frutal: '#e11d48', vinedo: '#9333ea',
  pistacho: '#059669', almendro: '#db2777', hortaliza: '#0d9488', arroz: '#0284c7',
  remolacha: '#c026d3', patata: '#a16207', algodon: '#475569',
};
function cropHex(crop?: string): string {
  return (crop && CROP_HEX[crop]) || '#6b7280';
}

function getParcelColor(parcel: Parcel, colorMode: 'estado' | 'cultivo' = 'estado'): string {
  if (colorMode === 'cultivo') return cropHex(parcel.cropType);
  const v = getLatestNdvi(parcel);
  if (v === null) return '#94a3b8';
  if (hasAlertOnParcel(parcel)) return '#ef4444';
  return ndviColor(v, parcel.cropType);
}

function getHealthLabel(ndvi: number, cropType?: string): string {
  return ndviHealthLabel(ndvi, cropType);
}

function getPolygonCenter(geometry: GeoJSON.Polygon): [number, number] {
  const coords = geometry.coordinates[0];
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  return [lat, lng];
}

function FitBounds({ parcels }: { parcels: Parcel[] }) {
  const map = useMap();
  // Sign by sorted IDs so the effect re-runs only when the set of parcels
  // actually changes (added/removed), not on every parent re-render. Without
  // this, "Ver todas" snaps back because FitBounds re-fires constantly.
  const idsKey = parcels.map((p) => p._id).sort().join(',');
  useEffect(() => {
    if (parcels.length === 0) return;
    const group = L.featureGroup(parcels.map((p) => L.geoJSON(p.geometry as GeoJSON.GeoJsonObject)));
    map.fitBounds(group.getBounds(), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, idsKey]);
  return null;
}

function FlyToParcel({ parcel }: { parcel: Parcel | undefined }) {
  const map = useMap();
  // Depend on the parcel ID, not the object reference. The parent recomputes
  // `parcel = parcels.find(...)` on every render, producing a new ref each
  // time even if the selection hasn't changed — that previously caused
  // flyToBounds to fire constantly and undo any zoom-out the user did.
  const id = parcel?._id;
  useEffect(() => {
    if (!parcel) return;
    const layer = L.geoJSON(parcel.geometry as GeoJSON.GeoJsonObject);
    map.flyToBounds(layer.getBounds(), { padding: [60, 60], duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, id]);
  return null;
}

function FitAllButton({ parcels }: { parcels: Parcel[] }) {
  const map = useMap();
  useEffect(() => {
    if (parcels.length === 0) return;
    const FitAllControl = L.Control.extend({
      onAdd() {
        const btn = L.DomUtil.create('button');
        btn.title = 'Ver todas las parcelas';
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:5px"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/></svg>Ver todas';
        btn.style.cssText =
          'background:linear-gradient(135deg,#354b23 0%,#4a6b2f 100%);border:none;padding:7px 13px;font-size:11px;font-weight:700;cursor:pointer;color:white;white-space:nowrap;border-radius:20px;margin:0;line-height:1.4;box-shadow:0 3px 10px rgba(53,75,35,0.45),0 1px 3px rgba(0,0,0,0.2);letter-spacing:0.3px;transition:all 0.15s ease;';
        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.on(btn, 'mouseover', () => {
          btn.style.transform = 'translateY(-1px)';
          btn.style.boxShadow = '0 5px 14px rgba(53,75,35,0.55),0 2px 4px rgba(0,0,0,0.2)';
        });
        L.DomEvent.on(btn, 'mouseout', () => {
          btn.style.transform = '';
          btn.style.boxShadow = '0 3px 10px rgba(53,75,35,0.45),0 1px 3px rgba(0,0,0,0.2)';
        });
        L.DomEvent.on(btn, 'click', () => {
          const group = L.featureGroup(parcels.map((p) => L.geoJSON(p.geometry as GeoJSON.GeoJsonObject)));
          map.fitBounds(group.getBounds(), { padding: [32, 32] });
        });
        return btn;
      },
    });
    const control = new FitAllControl({ position: 'topright' });
    control.addTo(map);
    return () => { control.remove(); };
  }, [map, parcels]);
  return null;
}

// Leyenda NDVI. Consciente del cultivo: para olivar de secano usa la escala
// real (0.2–0.4 es lo normal), no la genérica de cultivo denso — coherente
// con getParcelColor/cropHealth. Evita la contradicción "verde en el mapa,
// pero la leyenda dice Muy baja".
function NdviLegend({ cropType }: { cropType?: string }) {
  const map = useMap();
  useEffect(() => {
    const isOlive = cropType === 'olivo';
    const title = isOlive ? 'NDVI · SECANO' : 'NDVI';
    const rows: Array<[string, string]> = isOlive
      ? [
          ['#22c55e', '≥ 0.22 &nbsp;Normal'],
          ['#eab308', '0.15–0.22 &nbsp;Atención'],
          ['#f97316', '0.09–0.15 &nbsp;Bajo'],
          ['#ef4444', '&lt; 0.09 &nbsp;Crítico'],
        ]
      : [
          ['#ef4444', '&lt; 0.15 &nbsp;Sin vegetación'],
          ['#f97316', '0.15–0.25 &nbsp;Muy baja'],
          ['#eab308', '0.25–0.35 &nbsp;Estrés'],
          ['#84cc16', '0.35–0.45 &nbsp;Aceptable'],
          ['#22c55e', '0.45–0.55 &nbsp;Bueno'],
          ['#16a34a', '&gt; 0.55 &nbsp;&nbsp;&nbsp;&nbsp;Óptimo'],
        ];
    const LegendControl = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div');
        div.style.cssText = 'background:rgba(255,255,255,0.92);border:1px solid rgba(0,0,0,0.12);padding:7px 9px;border-radius:8px;font-size:10px;line-height:1.7;box-shadow:0 1px 4px rgba(0,0,0,0.12);backdrop-filter:blur(4px);';
        div.innerHTML =
          `<div style="font-weight:700;color:#354b23;margin-bottom:4px;font-size:10px;letter-spacing:0.05em;text-transform:uppercase">${title}</div>` +
          rows
            .map(([c, t]) => `<div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:2px;background:${c};flex-shrink:0"></div><span style="color:#374151">${t}</span></div>`)
            .join('');
        L.DomEvent.disableClickPropagation(div);
        return div;
      },
    });
    const control = new LegendControl({ position: 'bottomright' });
    control.addTo(map);
    return () => { control.remove(); };
  }, [map, cropType]);
  return null;
}

// Leyenda de CULTIVO para el modo "Cultivo" — lista los cultivos presentes
// con su color de contorno. Reemplaza la leyenda NDVI en ese modo.
function CropLegend({ parcels }: { parcels: Parcel[] }) {
  const map = useMap();
  const cropsKey = [...new Set(parcels.map((p) => p.cropType))].sort().join(',');
  useEffect(() => {
    const crops = [...new Set(parcels.map((p) => p.cropType))].sort();
    const LegendControl = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div');
        div.style.cssText = 'background:rgba(255,255,255,0.92);border:1px solid rgba(0,0,0,0.12);padding:7px 9px;border-radius:8px;font-size:10px;line-height:1.7;box-shadow:0 1px 4px rgba(0,0,0,0.12);backdrop-filter:blur(4px);';
        div.innerHTML =
          `<div style="font-weight:700;color:#354b23;margin-bottom:4px;font-size:10px;letter-spacing:0.05em;text-transform:uppercase">Cultivo</div>` +
          crops
            .map((c) => `<div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:2px;background:${cropHex(c)};flex-shrink:0"></div><span style="color:#374151;text-transform:capitalize">${cropLabel(c)}</span></div>`)
            .join('');
        L.DomEvent.disableClickPropagation(div);
        return div;
      },
    });
    const control = new LegendControl({ position: 'bottomright' });
    control.addTo(map);
    return () => { control.remove(); };
  }, [map, cropsKey]);
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

function ParcelLayer({ parcel, isSelected, onParcelClick, showDetailLink, colorMode }: {
  parcel: Parcel;
  isSelected: boolean;
  onParcelClick?: (id: string) => void;
  showDetailLink?: boolean;
  colorMode: 'estado' | 'cultivo';
}) {
  // Usa los helpers normalizados para soportar AMBOS shapes (ndviHistory[]
  // del endpoint completo + ndvi directo del endpoint agregado).
  const currentNdvi = getLatestNdvi(parcel);
  const color = getParcelColor(parcel, colorMode);
  const hasAlert = hasAlertOnParcel(parcel);
  // latest solo se usa para popups detallados (date/min/max), no para
  // colorear. Si viene del shape agregado, latest será undefined y el
  // popup omite esos campos extra — coherente con datos disponibles.
  const latest = parcel.ndviHistory?.[parcel.ndviHistory.length - 1];

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
            <div style="font-size:10px;color:#9ca3af">${getHealthLabel(latest.mean, parcel.cropType)}</div>
          </div>
        </div>
      ` : '<div style="font-size:11px;color:#9ca3af;margin-bottom:8px">Sin datos NDVI</div>'}
      ${showDetailLink ? `<a href="/dashboard/parcels/${parcel._id}" style="display:block;text-align:center;background:#46632e;color:#fff;text-decoration:none;font-size:11px;font-weight:600;padding:5px 10px;border-radius:6px">Ver detalle →</a>` : ''}
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
        fillOpacity: isSelected ? 0.45 : 0.30,
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
  focusParcelId,
  onParcelClick,
  height = '500px',
  showDetailLink = false,
  showLegend = false,
  mapStyle = 'satellite',
  colorMode = 'estado',
  children,
}: ParcelMapProps) {
  const focusParcel = focusParcelId ? parcels.find((p) => p._id === focusParcelId) : undefined;
  // Alertas conscientes del cultivo (misma lógica que el color del contorno y
  // los puntos de la lista). En modo "cultivo" NO pintamos pulsos: el foco es
  // ver el cultivo, no las alertas. Antes usaba un umbral fijo mean<0.3 que
  // marcaba en rojo un cereal cosechado normal (0.22–0.27).
  const alertParcels = colorMode === 'estado' ? parcels.filter((p) => hasAlertOnParcel(p)) : [];

  return (
    <MapContainer
      center={[39.0, -3.5]}
      zoom={6}
      style={{ height, width: '100%' }}
      className="rounded-xl border border-gray-200"
    >
      {mapStyle === 'satellite' ? (
        <>
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          <TileLayer
            attribution=""
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            opacity={0.6}
          />
        </>
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
      )}

      <FitBounds parcels={parcels} />
      <FitAllButton parcels={parcels} />
      <FlyToParcel parcel={focusParcel} />
      {showLegend && colorMode === 'estado' && (
        <NdviLegend
          cropType={
            parcels.length > 0 && parcels.every((p) => p.cropType === parcels[0].cropType)
              ? parcels[0].cropType
              : undefined
          }
        />
      )}
      {showLegend && colorMode === 'cultivo' && <CropLegend parcels={parcels} />}

      {parcels.map((parcel) => (
        <ParcelLayer
          key={parcel._id}
          parcel={parcel}
          isSelected={selectedParcelId === parcel._id}
          onParcelClick={onParcelClick}
          showDetailLink={showDetailLink}
          colorMode={colorMode}
        />
      ))}

      {alertParcels.map((parcel) => (
        <AlertPulse key={`pulse-${parcel._id}`} parcel={parcel} />
      ))}

      {children}
    </MapContainer>
  );
}
