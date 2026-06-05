/**
 * Sprint FIRMS · backend service · 04-jun-2026.
 *
 * Cliente para NASA FIRMS (Fire Information for Resource Management System)
 * — detección cuasi-tiempo-real de focos térmicos desde satélites VIIRS
 * (Suomi-NPP + NOAA-20, ~375 m de resolución) y MODIS (Aqua+Terra, ~1 km).
 *
 * Endpoint público (requiere MAP_KEY gratuita, registro en
 * https://firms.modaps.eosdis.nasa.gov/api/map_key/):
 *   https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{BBOX}/{DAYS}
 *
 * Diseño:
 *  · Combinamos VIIRS_SNPP_NRT + VIIRS_NOAA20_NRT (375 m, mejor resolución
 *    que MODIS 1 km — un foco real en una parcela de 12 ha se detecta
 *    con VIIRS, no siempre con MODIS).
 *  · Filtramos por distancia haversine desde el CENTROIDE de la parcela.
 *  · Confidence filter: descartamos puntos `confidence === 'l'` (low) por
 *    defecto — VIIRS marca como low los píxeles dudosos (ej. reflejo
 *    industrial, planta termoeléctrica). Configurable por endpoint.
 *  · Cache: ninguno en backend; el frontend usa react-query con staleTime
 *    de 1h. NASA FIRMS actualiza ~cada 3h, no merece cache server-side.
 *
 * Sin MAP_KEY el servicio devuelve `[]` con warning de log — el sistema
 * sigue funcionando, solo no muestra focos. Útil para entornos dev.
 */

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const SOURCES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT'] as const;

export interface FireDetection {
  /** Latitud del píxel detectado. */
  latitude: number;
  /** Longitud del píxel detectado. */
  longitude: number;
  /** Brillo en Kelvin (canal 4 µm en VIIRS). Cuanto mayor, más intenso. */
  brightness: number;
  /** ISO yyyy-mm-dd de adquisición. */
  acqDate: string;
  /** HHMM (UTC) de adquisición. */
  acqTime: string;
  /** Satélite que detectó: 'N' (Suomi-NPP), '1' (NOAA-20), etc. */
  satellite: string;
  /** Confidence label de NASA: 'l' (low), 'n' (nominal), 'h' (high). */
  confidence: string;
  /** Fire Radiative Power en MW. Proxy de intensidad energética. */
  frp: number;
  /** Día (D) o noche (N) en hora local del píxel. */
  dayNight: 'D' | 'N';
  /** Distancia (km) desde centroide de parcela hasta foco. Añadido por nosotros. */
  distanceKm: number;
}

/** Haversine entre dos puntos lat/lng en km. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Tierra media en km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Centroide simple de un polígono GeoJSON. */
function polygonCentroid(geometry: { coordinates: number[][][] }): { lat: number; lng: number } {
  const ring = geometry.coordinates[0] ?? [];
  if (ring.length === 0) throw new Error('Empty polygon ring');
  let sumLng = 0;
  let sumLat = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    sumLng += ring[i][0];
    sumLat += ring[i][1];
  }
  return { lng: sumLng / n, lat: sumLat / n };
}

/** Bounding box circular en grados (aprox) desde lat/lng + radio en km. */
function bboxAround(lat: number, lng: number, radiusKm: number): { west: number; south: number; east: number; north: number } {
  // 1° lat ≈ 111 km; 1° lng a esa lat ≈ 111 * cos(lat)
  const latRad = (lat * Math.PI) / 180;
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.1, Math.cos(latRad)));
  return {
    west: lng - dLng,
    south: lat - dLat,
    east: lng + dLng,
    north: lat + dLat,
  };
}

/** Parser CSV minimal — FIRMS devuelve cabecera + filas con comas. Sin
 *  campos entrecomillados (los datos son numéricos / fechas). */
function parseFirmsCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = (cols[i] ?? '').trim();
    });
    return row;
  });
}

/** Convierte una fila parseada CSV en FireDetection. */
function rowToDetection(row: Record<string, string>, centerLat: number, centerLng: number): FireDetection | null {
  const lat = parseFloat(row.latitude);
  const lng = parseFloat(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    latitude: lat,
    longitude: lng,
    brightness: parseFloat(row.bright_ti4 ?? row.brightness ?? '0'),
    acqDate: row.acq_date ?? '',
    acqTime: row.acq_time ?? '',
    satellite: row.satellite ?? '',
    confidence: row.confidence ?? 'n',
    frp: parseFloat(row.frp ?? '0'),
    dayNight: (row.daynight === 'D' || row.daynight === 'N') ? row.daynight : 'D',
    distanceKm: Math.round(haversineKm(centerLat, centerLng, lat, lng) * 10) / 10,
  };
}

/**
 * Devuelve los focos térmicos activos en los últimos N días dentro
 * del radio especificado desde el centroide de una parcela.
 *
 * @param geometry  Polígono GeoJSON de la parcela
 * @param radiusKm  Radio de búsqueda en km (default 25)
 * @param days      Ventana temporal en días (1-10, default 7)
 * @param opts.includeLowConfidence  Si true, incluye 'l' (default false)
 */
export async function fetchActiveFiresNearGeometry(
  geometry: { coordinates: number[][][] },
  radiusKm = 25,
  days = 7,
  opts: { includeLowConfidence?: boolean } = {},
): Promise<FireDetection[]> {
  if (!env.FIRMS_MAP_KEY) {
    logger.warn('firms_map_key_missing — returning empty array. Register at https://firms.modaps.eosdis.nasa.gov/api/map_key/');
    return [];
  }

  const center = polygonCentroid(geometry);
  const bbox = bboxAround(center.lat, center.lng, radiusKm);
  const bboxStr = `${bbox.west.toFixed(4)},${bbox.south.toFixed(4)},${bbox.east.toFixed(4)},${bbox.north.toFixed(4)}`;
  const daysClamped = Math.max(1, Math.min(10, days));

  const all: FireDetection[] = [];
  for (const source of SOURCES) {
    const url = `${FIRMS_BASE}/${env.FIRMS_MAP_KEY}/${source}/${bboxStr}/${daysClamped}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'text/csv' } });
      if (!res.ok) {
        // 05-jun-2026: capturamos también el body del 400 — antes solo el
        // status sin context. NASA devuelve mensajes legibles tipo
        // "Invalid MAP_KEY." que ayudan al diagnóstico (key expirada,
        // typo, rate limit). Primeros 200 chars para no inflar logs si
        // NASA devuelve HTML de error.
        const body = await res.text().catch(() => '');
        logger.warn(
          { source, status: res.status, body: body.slice(0, 200) },
          'firms_source_failed',
        );
        continue;
      }
      const csv = await res.text();
      const rows = parseFirmsCsv(csv);
      for (const row of rows) {
        const det = rowToDetection(row, center.lat, center.lng);
        if (!det) continue;
        if (!opts.includeLowConfidence && det.confidence === 'l') continue;
        if (det.distanceKm > radiusKm) continue;
        all.push(det);
      }
    } catch (err) {
      logger.warn({ err, source }, 'firms_source_error');
    }
  }

  // Sort by distance asc, luego por brillo desc
  all.sort((a, b) => a.distanceKm - b.distanceKm || b.brightness - a.brightness);
  logger.info(
    { totalFires: all.length, radiusKm, days, center, lowestDistanceKm: all[0]?.distanceKm ?? null },
    'firms_fetch_completed',
  );
  return all;
}

/** Versión por parcela cuando ya tenemos el doc de Mongo. */
export async function fetchActiveFiresNearParcel(
  parcel: { geometry: { coordinates: number[][][] } },
  opts: { radiusKm?: number; days?: number; includeLowConfidence?: boolean } = {},
): Promise<FireDetection[]> {
  return fetchActiveFiresNearGeometry(
    parcel.geometry,
    opts.radiusKm ?? 25,
    opts.days ?? 7,
    { includeLowConfidence: opts.includeLowConfidence },
  );
}
