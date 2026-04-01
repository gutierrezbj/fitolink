import { useMemo } from 'react';
import { GeoJSON } from 'react-leaflet';
import type { NdviSnapshot } from './useNdviSnapshot.js';

interface Props {
  snapshot: NdviSnapshot;
  opacity?: number;
}

// Half-side of each grid cell in degrees (~10m at Spain latitude)
const CELL_HALF = 0.000045;

function ndviToColor(ndvi: number): string {
  if (ndvi < 0.15) return '#7f1d1d';
  if (ndvi < 0.25) return '#dc2626';
  if (ndvi < 0.35) return '#f97316';
  if (ndvi < 0.45) return '#eab308';
  if (ndvi < 0.55) return '#84cc16';
  return '#16a34a';
}

function buildGeoJSON(snapshot: NdviSnapshot): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: snapshot.points.map((pt) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [pt.lng - CELL_HALF, pt.lat - CELL_HALF],
          [pt.lng + CELL_HALF, pt.lat - CELL_HALF],
          [pt.lng + CELL_HALF, pt.lat + CELL_HALF],
          [pt.lng - CELL_HALF, pt.lat + CELL_HALF],
          [pt.lng - CELL_HALF, pt.lat - CELL_HALF],
        ]],
      },
      properties: { ndvi: pt.ndvi },
    })),
  };
}

export default function NdviHeatmap({ snapshot, opacity = 0.72 }: Props) {
  const geojson = useMemo(() => buildGeoJSON(snapshot), [snapshot]);

  return (
    <GeoJSON
      key={snapshot._id}
      data={geojson}
      style={(feature) => ({
        fillColor: ndviToColor(feature?.properties?.ndvi ?? 0),
        fillOpacity: opacity,
        color: 'transparent',
        weight: 0,
      })}
      onEachFeature={(feature, layer) => {
        const ndvi = feature.properties?.ndvi as number;
        layer.bindTooltip(
          `<div style="font-family:Inter,system-ui,sans-serif;font-size:12px">
            <b style="color:${ndviToColor(ndvi)}">NDVI ${ndvi.toFixed(3)}</b>
          </div>`,
          { sticky: true, offset: [0, -4] },
        );
      }}
    />
  );
}
