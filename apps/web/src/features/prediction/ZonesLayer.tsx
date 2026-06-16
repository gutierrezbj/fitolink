/**
 * Capa de ZONAS DE MANEJO sobre el mapa — pinta las 360 celdas reales de
 * Encineño (compuesto Sentinel-2) coloreadas por zona (alto/medio/bajo vigor).
 * Misma técnica de rejilla que NdviHeatmap, pero color discreto por zona.
 * Cero invento: las celdas son las que calculó compute_zones.py.
 */
import { useEffect, useMemo } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ENCINENO_ZONE_CELLS, ENCINENO_ZONES, type ZoneCell } from './encinenoZonesRef.js';

// id de zona → color (0 = menor vigor … 2 = mayor). Visibles sobre satélite.
export const ZONE_COLOR: Record<number, string> = { 0: '#f97316', 1: '#eab308', 2: '#22c55e' };
const ZONE_LABEL: Record<number, string> = Object.fromEntries(ENCINENO_ZONES.map((z) => [z.id, z.label]));

function getCellDimensions(cells: ZoneCell[]): { lngHalf: number; latHalf: number } {
  const fallback = 0.000113; // ~10 m a latitud de España
  if (cells.length < 4) return { lngHalf: fallback, latHalf: fallback };
  const firstLat = cells[0].lat;
  const row = cells.filter((p) => p.lat === firstLat);
  let lngHalf = fallback;
  if (row.length >= 2) {
    const lngs = row.map((p) => p.lng).sort((a, b) => a - b);
    if (lngs[1] - lngs[0] > 0.00001) lngHalf = (lngs[1] - lngs[0]) / 2;
  }
  const firstLng = cells[0].lng;
  const col = cells.filter((p) => p.lng === firstLng);
  let latHalf = fallback;
  if (col.length >= 2) {
    const lats = col.map((p) => p.lat).sort((a, b) => a - b);
    if (lats[1] - lats[0] > 0.00001) latHalf = (lats[1] - lats[0]) / 2;
  }
  return { lngHalf, latHalf };
}

type ZoneFC = GeoJSON.FeatureCollection<GeoJSON.Polygon, { zone: number; ndvi: number }>;
function buildGeoJSON(cells: ZoneCell[], lngHalf: number, latHalf: number): ZoneFC {
  return {
    type: 'FeatureCollection',
    features: cells.map((c) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [c.lng - lngHalf, c.lat - latHalf],
          [c.lng + lngHalf, c.lat - latHalf],
          [c.lng + lngHalf, c.lat + latHalf],
          [c.lng - lngHalf, c.lat + latHalf],
          [c.lng - lngHalf, c.lat - latHalf],
        ]],
      },
      properties: { zone: c.zone, ndvi: c.ndvi },
    })),
  };
}

/**
 * Las celdas son las de ENCINEÑO. Regla nº1 (no_inventar): solo se pintan
 * cuando la parcela vinculada ES Encineño. `isEncineno=false` → no se renderiza
 * ni una celda (jamás zonas de una finca sobre otra). Sin el flag explícito,
 * por seguridad tampoco se pinta.
 */
export default function ZonesLayer({
  opacity = 0.6,
  isEncineno = false,
}: { opacity?: number; isEncineno?: boolean }) {
  const map = useMap();
  const cells = isEncineno ? ENCINENO_ZONE_CELLS : [];
  const { lngHalf, latHalf } = useMemo(() => getCellDimensions(cells), [cells]);
  const geojson = useMemo(() => buildGeoJSON(cells, lngHalf, latHalf), [cells, lngHalf, latHalf]);

  // El mapa vive en un contenedor que se dimensiona tarde (debajo del fold, en
  // un scroll). Leaflet calcula mal su tamaño al iniciar (carga tiles en una
  // franja y no encuadra). Un ResizeObserver sobre el contenedor dispara
  // invalidateSize + encuadre a las zonas en cuanto coge su tamaño real, así la
  // finca entera entra por defecto sin pulsar "Ver todas".
  useEffect(() => {
    if (!cells.length) return;
    const fit = () => {
      map.invalidateSize();
      const b = L.geoJSON(geojson as GeoJSON.GeoJsonObject).getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [22, 22], animate: false });
    };
    const el = map.getContainer();
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, [map, geojson, cells.length]);

  if (!cells.length) return null;

  return (
    <GeoJSON
      key="zones"
      data={geojson}
      style={(feature) => ({
        fillColor: ZONE_COLOR[feature?.properties?.zone ?? 0] ?? '#9ca3af',
        fillOpacity: opacity,
        color: 'transparent',
        weight: 0,
      })}
      onEachFeature={(feature, layer) => {
        const z = (feature.properties?.zone ?? 0) as number;
        const ndvi = (feature.properties?.ndvi ?? 0) as number;
        layer.bindTooltip(
          `<div style="font-family:Inter,system-ui,sans-serif;font-size:12px;padding:2px 4px">
            <b style="color:${ZONE_COLOR[z]}">${ZONE_LABEL[z] ?? 'Zona'}</b>
            <span style="color:#6b7280;margin-left:6px">NDVI ${ndvi.toFixed(2)}</span>
          </div>`,
          { sticky: true, offset: [0, -4] },
        );
      }}
    />
  );
}
