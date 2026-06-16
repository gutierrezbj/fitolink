/**
 * Tabla de features REALES de Encineño por campaña — precomputada offline desde
 * la serie Sentinel-2 (sandbox/modelo-cosecha/encineno_features_multimodal.csv).
 *
 * Por qué vive aquí y no en MongoDB: la serie diaria (350 lecturas) sí está en
 * la BD (parcel.ndviHistory), pero estos AGREGADOS por campaña (vigor integral,
 * lluvia, GDD, envero) se calculan en el pipeline Python y aún no tienen canal
 * de API. Para la POC del fondo se sirven como referencia estática HONESTA: son
 * valores REALES computados sobre la parcela real, no inventados ni de ejemplo.
 * Cuando exista el endpoint /prediction/encineno, esto se sustituye por fetch.
 *
 * Regla nº1 (no_inventar): aquí NO hay ninguna predicción (ni kg, ni fecha de
 * cosecha, ni % graso). Solo features observadas. Las campañas PARCIALES (medio
 * año de satélite) se marcan `complete: false` y quedan FUERA de toda señal o
 * tendencia — su vigor integral no es comparable con un año entero.
 */

export interface CampaignFeature {
  year: number;
  /** Campaña con año completo de satélite. Las parciales no entran en señales. */
  complete: boolean;
  /** Lluvia de primavera mar–may (mm) — el driver estrella del vigor en secano. */
  rainSpring: number;
  /** Lluvia anual (mm). */
  rainAnnual: number;
  /** Vigor acumulado de la campaña (integral del NDVI). */
  vigorIntegral: number;
  /** Pico de NDVI de la campaña. */
  ndviPeak: number;
  /** Grados-día acumulados (GDD) — calor de la campaña. */
  gddTotal: number;
  /** Nivel de NDRE de otoño (proxy de envero/maduración). null si sin otoño. */
  enveroNdre: number | null;
  /** Nº de escenas Sentinel-2 válidas en la campaña. */
  nScenes: number;
}

/** Valores literales de encineno_features_multimodal.csv (2022–2026). */
export const ENCINENO_CAMPAIGNS: CampaignFeature[] = [
  { year: 2022, complete: false, rainSpring: 230.3, rainAnnual: 511.2, vigorIntegral: 5.04, ndviPeak: 0.129, gddTotal: 3600, enveroNdre: 0.0513, nScenes: 50 },
  { year: 2023, complete: true, rainSpring: 88.9, rainAnnual: 353.4, vigorIntegral: 11.47, ndviPeak: 0.2995, gddTotal: 3587, enveroNdre: 0.0402, nScenes: 85 },
  { year: 2024, complete: true, rainSpring: 218.3, rainAnnual: 593.0, vigorIntegral: 13.64, ndviPeak: 0.333, gddTotal: 3421, enveroNdre: 0.0706, nScenes: 85 },
  { year: 2025, complete: true, rainSpring: 409.1, rainAnnual: 819.3, vigorIntegral: 16.94, ndviPeak: 0.3793, gddTotal: 3446, enveroNdre: 0.0786, nScenes: 100 },
  { year: 2026, complete: false, rainSpring: 166.8, rainAnnual: 444.4, vigorIntegral: 7.84, ndviPeak: 0.3077, gddTotal: 760, enveroNdre: null, nScenes: 30 },
];

/** Solo las campañas completas — las que sostienen la señal agua → vigor. */
export const COMPLETE_CAMPAIGNS = ENCINENO_CAMPAIGNS.filter((c) => c.complete);
