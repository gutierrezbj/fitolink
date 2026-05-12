/**
 * Backend-side geo helpers. Mirrors apps/web/src/features/marketplace/distance.ts
 * so server-side services (weather events, predictive insights) can resolve
 * parcel centroids without needing a frontend round-trip.
 */

export interface PolygonLike {
  type: 'Polygon';
  coordinates: number[][][];
}

/**
 * Polygon centroid by simple coordinate average. GeoJSON returns [lng, lat].
 * Good enough for sort, labels and weather-API lookups; we do not need
 * area-weighted centroids for this use case.
 */
export function polygonCentroid(geometry: PolygonLike): [number, number] {
  const ring = geometry.coordinates[0];
  if (!ring || ring.length === 0) return [0, 0];
  const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
  const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  return [lng, lat];
}
