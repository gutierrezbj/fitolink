/**
 * Sprint SoilGrids · backend service · 22-may-2026.
 *
 * Cliente para ISRIC SoilGrids v2.0 REST API. Consulta el perfil edáfico
 * de una parcela en el centroide de su geometría, agrega las capas
 * 0-5/5-15/15-30 cm en una "capa agronómica" (donde están las raíces
 * principales) y devuelve un ISoilProfile listo para persistir.
 *
 * Endpoint público (sin auth, gratuito, rate-limited razonablemente):
 *   https://rest.isric.org/soilgrids/v2.0/properties/query
 *
 * Diseño:
 *  · Una sola query por parcela (centroide). Suficiente para parcelas
 *    típicas 5-25 ha — la resolución 250m de SoilGrids ya implica que
 *    sub-parcela no es resolvible. Muestreo espacial multi-punto queda
 *    para V2 cuando tengamos demanda real de heterogeneidad.
 *  · Las unidades crudas de SoilGrids requieren conversión:
 *      clay/sand/silt:   g/kg → divide entre 10 para %
 *      soc (carbono):    dg/kg → divide entre 10 para g/kg
 *      bdod (densidad):  cg/cm³ → divide entre 100 para g/cm³
 *      wv0033 (cap.):    0.1 cm³/cm³ → divide entre 1000 para fracción 0-1
 *  · Textura dominante: triángulo USDA simplificado en castellano agronómico.
 */

import type { ISoilProfile } from '../models/Parcel.js';
import { logger } from '../utils/logger.js';

const SOILGRIDS_URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query';

// Propiedades que consultamos a la API. Las capas (depth) las decidimos abajo.
const PROPERTIES = ['clay', 'sand', 'silt', 'soc', 'bdod', 'wv0033'] as const;
const DEPTHS = ['0-5cm', '5-15cm', '15-30cm'] as const;

interface SoilGridsLayer {
  name: string;          // propiedad
  unit_measure: { d_factor: number; mapped_units: string; target_units: string; uncertainty_unit: string };
  depths: Array<{
    range: { top_depth: number; bottom_depth: number; unit_depth: string };
    label: string;       // ej "0-5cm"
    values: { mean?: number; uncertainty?: number };
  }>;
}

interface SoilGridsResponse {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { layers: SoilGridsLayer[] };
}

/** Centroide de un polígono GeoJSON simple (sin agujeros). Promedio
 *  aritmético de los vértices del anillo exterior — suficiente para
 *  parcelas convexas o casi convexas como las nuestras. */
export function polygonCentroid(geometry: { coordinates: number[][][] }): { lat: number; lng: number } {
  const ring = geometry.coordinates[0] ?? [];
  if (ring.length === 0) throw new Error('Empty polygon ring');
  let sumLng = 0;
  let sumLat = 0;
  // Excluimos el último punto (= primero) para no sesgar la media
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    sumLng += ring[i][0];
    sumLat += ring[i][1];
  }
  return { lng: sumLng / n, lat: sumLat / n };
}

/** Promedio simple de capas 0-5/5-15/15-30 cm con pesos por espesor. */
function weightedMeanAgronomicLayer(depths: SoilGridsLayer['depths']): number | null {
  // Espesores: 5 cm, 10 cm, 15 cm = 30 cm total
  const weights: Record<string, number> = { '0-5cm': 5, '5-15cm': 10, '15-30cm': 15 };
  let totalW = 0;
  let totalV = 0;
  for (const d of depths) {
    const w = weights[d.label];
    if (w === undefined) continue;
    const v = d.values.mean;
    if (typeof v !== 'number') continue;
    totalW += w;
    totalV += v * w;
  }
  if (totalW === 0) return null;
  return totalV / totalW;
}

/**
 * Textura dominante según triángulo USDA simplificado. Devuelve nombre
 * agronómico en castellano. Reglas pragmáticas — los umbrales exactos
 * USDA tienen 12 clases pero para uso comercial agrupamos a 7 familias
 * que un agricultor reconoce.
 */
function dominantTextureUSDA(clayPct: number, sandPct: number, siltPct: number): string {
  // Clases dominantes por composición (orden importa — primero los extremos)
  if (clayPct >= 40) {
    if (sandPct >= 45) return 'arcilla arenosa';
    if (siltPct >= 40) return 'arcilla limosa';
    return 'arcilla';
  }
  if (sandPct >= 70) {
    if (sandPct >= 85) return 'arenoso';
    return 'arena franca';
  }
  if (siltPct >= 80) return 'limoso';
  // Clases franco: el corazón del triángulo
  if (clayPct >= 27 && clayPct < 40) {
    if (sandPct >= 45) return 'franco arcillo arenoso';
    if (siltPct >= 40) return 'franco arcillo limoso';
    return 'franco arcilloso';
  }
  if (sandPct >= 45) return 'franco arenoso';
  if (siltPct >= 50) return 'franco limoso';
  return 'franco';
}

/**
 * Consulta SoilGrids para un punto (lat/lng) y devuelve un perfil
 * agregado de la capa agronómica 0-30 cm. Throws si la API falla o
 * devuelve datos incompletos — quien llama decide qué hacer.
 */
export async function fetchSoilProfileForPoint(lat: number, lng: number): Promise<ISoilProfile> {
  const params = new URLSearchParams();
  params.set('lon', String(lng));
  params.set('lat', String(lat));
  for (const p of PROPERTIES) params.append('property', p);
  for (const d of DEPTHS) params.append('depth', d);
  params.append('value', 'mean');

  const url = `${SOILGRIDS_URL}?${params.toString()}`;
  logger.info({ url }, 'soilgrids_fetch_start');
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`SoilGrids HTTP ${res.status} ${res.statusText}`);
  }
  const raw = (await res.json()) as SoilGridsResponse;
  const layers = raw.properties?.layers ?? [];

  // Helper para extraer un valor agronómico por propiedad
  const valueFor = (propName: string): number | null => {
    const layer = layers.find((l) => l.name === propName);
    if (!layer) return null;
    return weightedMeanAgronomicLayer(layer.depths);
  };

  // SoilGrids devuelve en unidades crudas — convertimos a unidades usables
  const clayRaw = valueFor('clay');
  const sandRaw = valueFor('sand');
  const siltRaw = valueFor('silt');
  const socRaw = valueFor('soc');
  const bdodRaw = valueFor('bdod');
  const wv0033Raw = valueFor('wv0033');

  if (clayRaw === null || sandRaw === null || siltRaw === null) {
    throw new Error('SoilGrids returned incomplete texture data');
  }

  // Conversión de unidades
  const clayPct = clayRaw / 10;            // g/kg → %
  const sandPct = sandRaw / 10;
  const siltPct = siltRaw / 10;
  const organicCarbonGkg = (socRaw ?? 0) / 10;       // dg/kg → g/kg
  const bulkDensityGcm3 = (bdodRaw ?? 130) / 100;    // cg/cm³ → g/cm³ (default 1.30)
  const fieldCapacityVol = (wv0033Raw ?? 280) / 1000; // 0.1 cm³/cm³ → fracción (default ~0.28)

  // Renormalizamos texturas para que sumen 100 (SoilGrids puede dar 98-102 por ruido)
  const totalTexture = clayPct + sandPct + siltPct;
  const factor = totalTexture > 0 ? 100 / totalTexture : 1;
  const clay = clayPct * factor;
  const sand = sandPct * factor;
  const silt = siltPct * factor;

  return {
    source: 'soilgrids-v2',
    fetchedAt: new Date(),
    clayPct: Math.round(clay * 10) / 10,
    sandPct: Math.round(sand * 10) / 10,
    siltPct: Math.round(silt * 10) / 10,
    organicCarbonGkg: Math.round(organicCarbonGkg * 10) / 10,
    bulkDensityGcm3: Math.round(bulkDensityGcm3 * 100) / 100,
    fieldCapacityVol: Math.round(fieldCapacityVol * 1000) / 1000,
    dominantTexture: dominantTextureUSDA(clay, sand, silt),
    sampledAt: { lat, lng },
  };
}

/**
 * Conveniencia: fetch del perfil para una parcela (toma el centroide
 * de su geometría). Quien llama controla qué hacer si la API falla
 * (ej. fire-and-forget vs throw).
 */
export async function fetchSoilProfileForParcel(parcel: {
  geometry: { coordinates: number[][][] };
}): Promise<ISoilProfile> {
  const { lat, lng } = polygonCentroid(parcel.geometry);
  return fetchSoilProfileForPoint(lat, lng);
}
