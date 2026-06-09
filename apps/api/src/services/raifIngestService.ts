/**
 * raifIngestService · F1 día 1 · ingestor RAIF Andalucía.
 *
 * Visión PM (JuanCho 9-jun-2026): cubrir los 17 servicios fitosanitarios
 * autonómicos de España con scrapers per CCAA. F1 cubre las 4 CCAA con
 * mayor cobertura del mercado agrícola español (~60% PIB agrícola):
 *   - RAIF Andalucía       (este servicio)
 *   - DARP Cataluña        (futuro · darpIngestService)
 *   - SAIF/IVIA Valencia   (futuro · saifIngestService)
 *   - IRIAF Castilla-La Mancha (futuro · iriafIngestService)
 *
 * F1 día 1 (HOY): scaffolding + datos verificados del portal RAIF Prays
 * oleae copy-pasteados literalmente. NO hay aún scraper HTML automatizado ·
 * los datos hardcoded vienen del informe REAL publicado 01-oct-2025 en:
 *   https://www.juntadeandalucia.es/agriculturapescaaguaydesarrollorural/
 *     raif/estado-fitosanitario-actual-de-prays-oleae-en-andalucia/
 *
 * F1 día 2-3: convertir `fetchPraysOleaeReport()` a scraper HTML real con
 * fetch + parser regex sobre el HTML del portal. La interfaz del service
 * NO cambia · solo cambia la implementación interna (la BD seguirá
 * recibiendo los mismos PestAdvisory objects).
 *
 * F1 día 4-6: ampliar a otros boletines RAIF que existen en el portal
 * (Mosca del olivo · Repilo · Saissetia · cochinilla · etc.) cada uno con
 * su fetcher dedicado.
 *
 * Honor CRITICAL_no_inventar · todos los datos verificables clickeando
 * sourceUrl. Si los scrapers fallan o el portal cambia, los logs deben
 * capturar body del error (regla "logs con body").
 */

import { logger } from '../utils/logger.js';

// ── Tipos compartidos ─────────────────────────────────────────────────

export interface RaifProvinceReport {
  /** Nombre canónico provincia (debe matchear PROVINCES en @fitolink/shared) */
  province: 'Almeria' | 'Cadiz' | 'Cordoba' | 'Granada' | 'Huelva' | 'Jaen' | 'Malaga' | 'Sevilla';
  /** % aceitunas con plaga vivo (si lo reporta el portal · undefined si no) */
  percentInfested?: number;
  /** Adultos/trampa/día capturados (si lo reporta el portal) */
  capturesPerTrapPerDay?: number;
  /** % supervivencia de larvas (si lo reporta el portal) */
  larvaSurvivalPercent?: number;
}

export interface RaifPestReport {
  /** Plaga/enfermedad concreta */
  pestScientificName: string;
  pestCommonName: string;
  /** Fecha publicación del informe en el portal */
  reportPublishedAt: Date;
  /** Generación o estado biológico mencionado (carpófaga / filófaga / antófaga) */
  biologicalStage?: string;
  /** Estado fenológico dominante del cultivo según portal (e.g. "H endurecimiento de hueso") */
  phenologicalStage?: string;
  /** Umbral de tratamiento que el portal cita */
  treatmentThreshold?: string;
  /** Datos por provincia */
  provinces: RaifProvinceReport[];
  /** URL canónica del informe en el portal RAIF */
  sourceUrl: string;
}

// ── Datos verificados (F1 día 1) ──────────────────────────────────────

/**
 * Devuelve los datos LITERALES del informe Prays oleae en Andalucía
 * publicado en el portal RAIF el 01-oct-2025.
 *
 * F1 día 1: hardcoded del portal · verificado via WebFetch 9-jun-2026.
 * F1 día 2-3 (futuro): este método será sustituido por un scraper HTML
 * real (fetch + parser regex sobre el portal). La interfaz no cambia.
 *
 * Si en el futuro el portal cambia su estructura, este método capturará
 * el body del error con la regla `logs con body del error externo`.
 */
export async function fetchPraysOleaeReport(): Promise<RaifPestReport> {
  // TODO F1 día 2: sustituir esta sección hardcoded por scraping real:
  //
  //   const res = await fetch(SOURCE_URL);
  //   if (!res.ok) {
  //     const body = await res.text().catch(() => '');
  //     logger.warn({ source: 'RAIF', status: res.status, body: body.slice(0, 200) },
  //                 'external_api_failed');
  //     throw new Error(`RAIF Prays fetch failed: HTTP ${res.status}`);
  //   }
  //   const html = await res.text();
  //   return parseRaifPraysHtml(html);
  //
  // Por ahora devolvemos los datos VERIFICADOS del portal el 9-jun-2026:

  logger.info({ source: 'RAIF', report: 'Prays oleae' }, 'fetchPraysOleaeReport · using hardcoded verified data');

  return {
    pestScientificName: 'Prays oleae',
    pestCommonName: 'polilla del olivo',
    reportPublishedAt: new Date('2025-10-01'),
    biologicalStage: 'Generación carpófaga · primeros vuelos · próximamente generación filófaga',
    phenologicalStage: 'H · endurecimiento de hueso',
    treatmentThreshold: '≥20% aceitunas con Prays vivo + ~20% huevos eclosionados',
    sourceUrl: 'https://www.juntadeandalucia.es/agriculturapescaaguaydesarrollorural/raif/estado-fitosanitario-actual-de-prays-oleae-en-andalucia/',
    provinces: [
      { province: 'Malaga', percentInfested: 45.1, capturesPerTrapPerDay: 16.1, larvaSurvivalPercent: 1.3 },
      { province: 'Cordoba', percentInfested: 35.1 },
      { province: 'Sevilla', percentInfested: 35.0, capturesPerTrapPerDay: 5.7, larvaSurvivalPercent: 1.3 },
      { province: 'Cadiz', capturesPerTrapPerDay: 4.1 },
      { province: 'Granada', larvaSurvivalPercent: 1.0 },
    ],
  };
}

// ── Roadmap futuro · stubs para próximas iteraciones ──────────────────

/**
 * F1 día 2-3 · sustituye `fetchPraysOleaeReport()` con scraper HTML real.
 * Esta función parseará el HTML del portal con regex y devolverá el mismo
 * `RaifPestReport`. La interfaz no cambia · solo se actualizan los datos
 * a la última publicación del portal.
 *
 * Patrón previsible:
 *   - Tabla "Generación carpófaga": `<td>Málaga</td><td>45,1%</td>`
 *   - Tabla "Capturas adultos": `<td>Málaga</td><td>16,1</td>`
 *   - Tabla "Supervivencia larvas": `<td>Málaga</td><td>1,3%</td>`
 */
// export async function fetchPraysOleaeReportLive(): Promise<RaifPestReport> { ... }

/**
 * F1 día 4-6 · ampliación a otras plagas que el portal RAIF cubre con
 * páginas dedicadas (Bactrocera oleae · Spilocaea oleagina · Saissetia
 * oleae · etc.). Cada una con su URL específica y su parser.
 */
// export async function fetchBactroceraOleaeReport(): Promise<RaifPestReport> { ... }
// export async function fetchRepiloReport(): Promise<RaifPestReport> { ... }
