/**
 * KML / KMZ / GPX / GeoJSON parser → unified GeoJSON FeatureCollection.
 *
 * Ported from DroneHub (`frontend/src/pages/MissionCheck/missionParser.js`)
 * with TypeScript typing. Parser core is identical: runs entirely in the
 * browser, no backend round-trip, tolerant to iCloud / Drive synthesized
 * Files via FileReader API.
 */

import { kml, gpx } from '@tmcw/togeojson';
import JSZip from 'jszip';

export type MissionType = 'kml' | 'kmz' | 'gpx' | 'geojson';

export interface ParsedMission extends GeoJSON.FeatureCollection {
  meta: {
    originalType: MissionType;
    filename: string;
    sizeBytes: number;
  };
}

/** Detects file type from filename or content sniff. */
export function detectMissionType(filename: string, content?: string): MissionType | null {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.kmz')) return 'kmz';
  if (lower.endsWith('.kml')) return 'kml';
  if (lower.endsWith('.gpx')) return 'gpx';
  if (lower.endsWith('.geojson') || lower.endsWith('.json')) return 'geojson';
  if (typeof content === 'string') {
    const head = content.slice(0, 256).toLowerCase();
    if (head.includes('<kml')) return 'kml';
    if (head.includes('<gpx')) return 'gpx';
    if (head.trim().startsWith('{')) return 'geojson';
  }
  return null;
}

// ── Robust file reading ──────────────────────────────────────────────────────
// Prefer FileReader: it works on synthesized Files (demo button), iCloud/Drive
// paths and edge-case browsers where Blob.text() / Blob.arrayBuffer() throw
// `NotReadableError`.

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('FILE_READ_FAIL'));
    r.onabort = () => reject(new Error('FILE_READ_FAIL'));
    r.readAsText(file);
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(new Error('FILE_READ_FAIL'));
    r.onabort = () => reject(new Error('FILE_READ_FAIL'));
    r.readAsArrayBuffer(file);
  });
}

// ── Parsers (work on raw text/buffers, browser-agnostic) ─────────────────────

function parseKmlText(text: string): GeoJSON.FeatureCollection {
  const dom = new DOMParser().parseFromString(text, 'application/xml');
  if (dom.getElementsByTagName('parsererror').length) throw new Error('PARSE_ERROR');
  const fc = kml(dom) as GeoJSON.FeatureCollection;
  if (!fc?.features?.length) throw new Error('EMPTY_MISSION');
  return fc;
}

function parseGpxText(text: string): GeoJSON.FeatureCollection {
  const dom = new DOMParser().parseFromString(text, 'application/xml');
  if (dom.getElementsByTagName('parsererror').length) throw new Error('PARSE_ERROR');
  const fc = gpx(dom) as GeoJSON.FeatureCollection;
  if (!fc?.features?.length) throw new Error('EMPTY_MISSION');
  return fc;
}

function parseGeoJsonText(text: string): GeoJSON.FeatureCollection {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('PARSE_ERROR');
  }
  const obj = data as { type?: string; features?: unknown[] };
  if (obj?.type === 'Feature') {
    return { type: 'FeatureCollection', features: [data as GeoJSON.Feature] };
  }
  if (obj?.type !== 'FeatureCollection') throw new Error('UNSUPPORTED_FORMAT');
  if (!obj.features?.length) throw new Error('EMPTY_MISSION');
  return data as GeoJSON.FeatureCollection;
}

async function parseKmzBuffer(buffer: ArrayBuffer): Promise<GeoJSON.FeatureCollection> {
  const zip = await JSZip.loadAsync(buffer);
  const kmlEntry = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith('.kml'));
  if (!kmlEntry) throw new Error('KMZ_NO_KML');
  const text = await zip.files[kmlEntry].async('text');
  return parseKmlText(text);
}

interface ParseInput {
  type: MissionType;
  text?: string;
  buffer?: ArrayBuffer;
  filename?: string;
}

/** Parses raw text/buffer content directly (no File wrapper). */
export async function parseMissionContent({
  type,
  text,
  buffer,
  filename = 'mission',
}: ParseInput): Promise<ParsedMission> {
  let fc: GeoJSON.FeatureCollection;
  if (type === 'kml') fc = parseKmlText(text!);
  else if (type === 'gpx') fc = parseGpxText(text!);
  else if (type === 'geojson') fc = parseGeoJsonText(text!);
  else if (type === 'kmz') fc = await parseKmzBuffer(buffer!);
  else throw new Error('UNSUPPORTED_FORMAT');

  const features = fc.features.filter(
    (f) => f?.geometry && 'coordinates' in f.geometry && f.geometry.coordinates,
  );
  if (features.length === 0) throw new Error('EMPTY_MISSION');

  return {
    type: 'FeatureCollection',
    features,
    meta: {
      originalType: type,
      filename,
      sizeBytes: text?.length ?? buffer?.byteLength ?? 0,
    },
  };
}

/**
 * Parses a File object → GeoJSON FeatureCollection.
 * Throws Error with a stable string code (mapped to localized messages by the UI).
 */
export async function parseMissionFile(file: File): Promise<ParsedMission> {
  if (!file) throw new Error('NO_FILE');
  if (file.size > 10 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');

  const type = detectMissionType(file.name);
  if (!type) throw new Error('UNSUPPORTED_FORMAT');

  if (type === 'kmz') {
    const buffer = await readFileAsArrayBuffer(file);
    return parseMissionContent({ type, buffer, filename: file.name });
  }
  const text = await readFileAsText(file);
  return parseMissionContent({ type, text, filename: file.name });
}

// ── Polygon helpers (FitoLink-specific — DroneHub's parser was for tracks) ──

/** Approximate polygon area in hectares using equirectangular projection. */
export function polygonAreaHa(coords: GeoJSON.Position[]): number {
  if (coords.length < 3) return 0;
  const latMean = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const R = 6371000; // m
  const xy = coords.map(([lon, lat]) => [
    R * (lon * Math.PI) / 180 * Math.cos((latMean * Math.PI) / 180),
    R * (lat * Math.PI) / 180,
  ]);
  let area = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2 / 10000; // m² → ha
}

/** Centroid of a polygon ring. */
export function polygonCentroid(coords: GeoJSON.Position[]): [number, number] {
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lng, lat];
}

/**
 * Extract polygon-only features from a parsed mission, with FitoLink-friendly
 * shape: { name, geometry, areaHa }. Drops non-polygon features (tracks,
 * markers) since FitoLink parcels are always polygons.
 */
export interface PolygonFeature {
  name: string;
  geometry: GeoJSON.Polygon;
  areaHa: number;
  centroid: [number, number];
}

/**
 * Force every coordinate to a 2-element [lon, lat] tuple. KML/KMZ files
 * exported from Google Earth ship `[lon, lat, altitude]` (altitude is
 * typically 0). FitoLink's GeoJSON model is 2D; the API schema rejects
 * tuples longer than 2. Strip altitude here so callers get clean data.
 */
function strip2D(coords: GeoJSON.Position[]): [number, number][] {
  return coords.map((c) => [c[0], c[1]] as [number, number]);
}

export function extractPolygons(fc: ParsedMission): PolygonFeature[] {
  const out: PolygonFeature[] = [];
  fc.features.forEach((f, idx) => {
    const g = f.geometry;
    if (!g) return;
    const name =
      (f.properties && typeof f.properties === 'object' && 'name' in f.properties
        ? String((f.properties as Record<string, unknown>).name)
        : '') || `Parcela ${idx + 1}`;

    if (g.type === 'Polygon') {
      const cleaned: GeoJSON.Polygon = {
        type: 'Polygon',
        coordinates: g.coordinates.map(strip2D),
      };
      const ring = cleaned.coordinates[0];
      out.push({
        name,
        geometry: cleaned,
        areaHa: Number(polygonAreaHa(ring).toFixed(2)),
        centroid: polygonCentroid(ring),
      });
    } else if (g.type === 'MultiPolygon') {
      // Split multi-polygons into one parcel per ring (common in cadastral KMZs)
      g.coordinates.forEach((poly, i) => {
        const cleanedPoly = poly.map(strip2D);
        const ring = cleanedPoly[0];
        out.push({
          name: g.coordinates.length > 1 ? `${name} (${i + 1})` : name,
          geometry: { type: 'Polygon', coordinates: cleanedPoly },
          areaHa: Number(polygonAreaHa(ring).toFixed(2)),
          centroid: polygonCentroid(ring),
        });
      });
    }
  });
  return out;
}

// ── Error code → user-facing message (Spanish) ──────────────────────────────

export const ERROR_MESSAGES: Record<string, string> = {
  NO_FILE: 'Selecciona un archivo',
  FILE_TOO_LARGE: 'El archivo supera 10 MB',
  UNSUPPORTED_FORMAT: 'Formato no soportado. Usa .kml, .kmz, .gpx o .geojson',
  PARSE_ERROR: 'No se ha podido leer el archivo (XML/JSON inválido)',
  KMZ_NO_KML: 'El KMZ no contiene un archivo .kml interno',
  EMPTY_MISSION: 'El archivo no contiene polígonos válidos',
  FILE_READ_FAIL: 'No se ha podido leer el archivo. Inténtalo de nuevo',
};
