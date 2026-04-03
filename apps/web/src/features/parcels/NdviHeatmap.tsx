import { useMemo } from 'react';
import { GeoJSON } from 'react-leaflet';
import type { NdviSnapshot } from './useNdviSnapshot.js';

interface Props {
  snapshot: NdviSnapshot;
  opacity?: number;
}

function getCellHalf(points: NdviSnapshot['points']): number {
  if (points.length < 2) return 0.000045;
  const firstLat = points[0].lat;
  const row = points.filter((p) => Math.abs(p.lat - firstLat) < 0.000005).slice(0, 4);
  if (row.length >= 2) {
    const lngs = row.map((p) => p.lng).sort((a, b) => a - b);
    const spacing = lngs[1] - lngs[0];
    if (spacing > 0.000005) return spacing / 2;
  }
  return 0.000045;
}

function ndviToColor(ndvi: number): string {
  if (ndvi < 0.15) return '#7f1d1d';
  if (ndvi < 0.25) return '#dc2626';
  if (ndvi < 0.35) return '#f97316';
  if (ndvi < 0.45) return '#eab308';
  if (ndvi < 0.55) return '#84cc16';
  return '#16a34a';
}

type NdviFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon, { ndvi: number }>;

function buildGeoJSON(snapshot: NdviSnapshot, cellHalf: number): NdviFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: snapshot.points.map((pt) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [pt.lng - cellHalf, pt.lat - cellHalf],
          [pt.lng + cellHalf, pt.lat - cellHalf],
          [pt.lng + cellHalf, pt.lat + cellHalf],
          [pt.lng - cellHalf, pt.lat + cellHalf],
          [pt.lng - cellHalf, pt.lat - cellHalf],
        ]],
      },
      properties: { ndvi: pt.ndvi },
    })),
  };
}

export default function NdviHeatmap({ snapshot, opacity = 0.72 }: Props) {
  const cellHalf = useMemo(() => getCellHalf(snapshot.points), [snapshot.points]);
  const geojson = useMemo(() => buildGeoJSON(snapshot, cellHalf), [snapshot, cellHalf]);

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
        const ndvi = (feature.properties?.ndvi ?? 0) as number;
        const label =
          ndvi < 0.15 ? 'Sin vegetacion' :
          ndvi < 0.25 ? 'Muy escasa' :
          ndvi < 0.35 ? 'Escasa' :
          ndvi < 0.45 ? 'Moderada' :
          ndvi < 0.55 ? 'Buena' : 'Optima';
        layer.bindTooltip(
          `<div style="font-family:Inter,system-ui,sans-serif;font-size:12px;padding:2px 4px">
            <b style="color:${ndviToColor(ndvi)}">NDVI ${ndvi.toFixed(3)}</b>
            <span style="color:#6b7280;margin-left:6px">${label}</span>
          </div>`,
          { sticky: true, offset: [0, -4] },
        );
      }}
    />
  );
}
