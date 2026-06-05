import type { Polygon } from 'geojson';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const SIGPAC_BASE_URL = 'https://sigpac-hubcloud.es/servicioconsultassigpac/query/recinfo';

interface SigpacFeatureProperties {
  superficie?: number;
  uso_sigpac?: string;
  [key: string]: unknown;
}

interface SigpacFeature {
  type: 'Feature';
  geometry: Polygon;
  properties: SigpacFeatureProperties;
}

interface SigpacFeatureCollection {
  type: 'FeatureCollection';
  features: SigpacFeature[];
}

export interface SigpacResult {
  geometry: Polygon;
  areaHa: number;
  cropUse: string;
}

export async function fetchByReference(
  prov: string,
  muni: string,
  agre: string,
  zona: string,
  poligono: string,
  parcela: string,
  recinto: string,
): Promise<SigpacResult> {
  const url = `${SIGPAC_BASE_URL}/${prov}/${muni}/${agre}/${zona}/${poligono}/${parcela}/${recinto}.geojson`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw AppError.internal('Error al conectar con el servicio SIGPAC');
  }

  if (!response.ok) {
    // Regla operativa 05-jun-2026: capturar body del error 200ch (excepto
    // 404 que es esperado · usuario probó ref inexistente). Para 5xx o
    // 4xx no-404 sí queremos el body porque SIGPAC devuelve mensajes
    // útiles tipo "Bad request" con razón concreta o "Server overload".
    // Ver glossary "Regla operativa logs con body del error externo".
    if (response.status === 404) {
      throw AppError.notFound('Recinto SIGPAC');
    }
    const body = await response.text().catch(() => '');
    logger.warn(
      { source: 'sigpac-hubcloud', status: response.status, body: body.slice(0, 200), url },
      'sigpac_fetch_failed',
    );
    throw AppError.internal(`SIGPAC respondió con estado ${response.status}`);
  }

  let data: SigpacFeatureCollection;
  try {
    data = (await response.json()) as SigpacFeatureCollection;
  } catch {
    throw AppError.internal('Respuesta SIGPAC inválida');
  }

  if (!data.features || data.features.length === 0) {
    throw AppError.notFound('Recinto SIGPAC');
  }

  const feature = data.features[0];

  if (!feature.geometry || feature.geometry.type !== 'Polygon') {
    throw AppError.internal('La geometría SIGPAC no es un polígono válido');
  }

  const superficie = feature.properties?.superficie;
  const areaHa = typeof superficie === 'number' ? superficie : 0;
  const cropUse = typeof feature.properties?.uso_sigpac === 'string' ? feature.properties.uso_sigpac : '';

  return {
    geometry: feature.geometry,
    areaHa,
    cropUse,
  };
}
