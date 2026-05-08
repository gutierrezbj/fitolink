/**
 * Geographic distance helpers for the marketplace.
 *
 * The map shows entities as `[lng, lat]` (GeoJSON convention). Cards display
 * "5.2 km de tu parcela más cercana" — that requires comparing every provider
 * against every parcel of the logged-in farmer.
 *
 * Haversine is sufficient at the scales we deal with (Spain → tens of km).
 * Pure functions, no globals, easy to unit-test.
 */

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two `[lng, lat]` points, in kilometres. */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Polygon centroid by simple coordinate average. Good enough for sort/labels. */
export function polygonCentroid(geometry: GeoJSON.Polygon): [number, number] {
  const ring = geometry.coordinates[0];
  const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
  const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  return [lng, lat];
}

interface ParcelLike {
  _id: string;
  name: string;
  geometry: GeoJSON.Polygon;
}

export interface NearestParcel {
  parcelId: string;
  parcelName: string;
  km: number;
}

/**
 * For a provider location, find the nearest parcel of the farmer.
 * Returns null if the user has no parcels.
 */
export function findNearestParcel(
  providerLoc: [number, number],
  parcels: ParcelLike[],
): NearestParcel | null {
  if (!parcels.length) return null;
  let best: NearestParcel | null = null;
  for (const p of parcels) {
    const km = distanceKm(providerLoc, polygonCentroid(p.geometry));
    if (!best || km < best.km) {
      best = { parcelId: p._id, parcelName: p.name, km };
    }
  }
  return best;
}

/** Format a distance for the UI: "5.2 km" / "12 km" / "120 km". */
export function formatKm(km: number): string {
  if (km < 1) return '< 1 km';
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
