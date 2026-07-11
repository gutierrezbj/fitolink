// User roles
// `cooperative` represents an entity that aggregates many farmers (socios).
// It owns no parcels itself; it sees an overview of its socios' parcels via
// the `cooperativeId` link on User.
//
// `adv` (Agrupación de Defensa Vegetal) · 05-jun-2026 · entidad institucional
// que vigila colectivamente plagas/enfermedades en una comarca y reporta al
// RAIF. Estructuralmente parecido a `cooperative` (agrega farmers), pero el
// foco no es comercialización sino sanidad vegetal: vigilancia comarcal +
// avisos preventivos a socios + cumplimiento normativo RAIF. Buyer
// institucional prioritario campaña 2026 según decisión PM 04-jun.
// `regantes` (Comunidad de Regantes) · 05-jun-2026 · entidad institucional
// que gestiona el riego colectivo + reparto de agua entre socios agrarios.
// Estructuralmente similar a cooperative + adv (agrega farmers vía
// cooperativeId), foco diferente: justificar reparto hídrico con datos
// objetivos para cumplir RD 950/2024 (reducción obligatoria consumo agua
// agraria) en contexto sequía 2024-2026. Stack alineado: NDVI + LST +
// ERA5 drought + Open-Meteo + SoilGrids. ~700 comunidades en España,
// foco campaña 2026 Andalucía + Levante.
export const USER_ROLES = ['farmer', 'pilot', 'agronomist', 'insurer', 'admin', 'cooperative', 'adv', 'regantes'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Operation types
export const OPERATION_TYPES = ['phytosanitary', 'inspection', 'diagnosis', 'herbicide', 'fertilization', 'seeding'] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

// Operation statuses
export const OPERATION_STATUSES = ['requested', 'assigned', 'in_progress', 'completed', 'cancelled'] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

// Unidades de dosis para los productos de una aplicación (mezcla de tanque).
// Sólidos en g/kg por ha, líquidos en mL/L por ha. Para bioestimulantes,
// microbiota y fitosanitarios por igual — el informe muestra dosis + unidad.
export const APPLICATION_UNITS = ['g/ha', 'kg/ha', 'mL/ha', 'L/ha'] as const;
export type ApplicationUnit = (typeof APPLICATION_UNITS)[number];

// Alert types
// Sprint FIRMS · 04-jun-2026: añadido 'fire_proximity' — foco térmico
// detectado por NASA FIRMS (VIIRS 375m) dentro del radio de la parcela.
// Sprint Notificación de Plagas · 12-jul-2026: añadido 'pest_advisory' —
// aviso fitosanitario oficial (PestAdvisory) que matchea cultivo + radio
// de la parcela; lo crea el fan-out de pestAdvisoryService.
export const ALERT_TYPES = ['ndvi_drop', 'ndre_anomaly', 'stress_pattern', 'fire_proximity', 'pest_advisory'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

// Alert severities
export const ALERT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

// Alert statuses
export const ALERT_STATUSES = ['new', 'notified', 'acknowledged', 'resolved'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

// NDVI data sources
export const NDVI_SOURCES = ['sentinel2', 'planet'] as const;
export type NdviSource = (typeof NDVI_SOURCES)[number];

// Marketplace provider categories (non-login directory entries)
// Pilots stay as User with role='pilot' (they operate actively).
// Distributors / agronomists / cooperatives are listings only — no login required.
export const PROVIDER_CATEGORIES = ['phyto-distributor', 'agronomist', 'cooperative'] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export const LEAD_TYPES = ['cooperative-program', 'general-contact'] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_STATUSES = ['new', 'contacted', 'closed', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

// Alert resolution types
export const ALERT_RESOLUTIONS = ['service', 'false_positive', 'natural_recovery'] as const;
export type AlertResolution = (typeof ALERT_RESOLUTIONS)[number];

// Common crop types in Spain
export const CROP_TYPES = [
  'olivo',
  'vinedo',
  'cereal',
  'girasol',
  'algodon',
  'frutal',
  'hortaliza',
  'citrico',
  'almendro',
  'pistacho',
  'arroz',
  'maiz',
  'remolacha',
  'patata',
  'leguminosa',
  'otro',
] as const;
export type CropType = (typeof CROP_TYPES)[number];

// Spanish provinces for pilot zones
export const PROVINCES = [
  'Almeria', 'Cadiz', 'Cordoba', 'Granada', 'Huelva', 'Jaen', 'Malaga', 'Sevilla',
  'Albacete', 'Ciudad Real', 'Cuenca', 'Guadalajara', 'Toledo',
  'Badajoz', 'Caceres',
  'Huesca', 'Teruel', 'Zaragoza',
  'Lleida', 'Tarragona',
  'Murcia',
  'Valencia', 'Alicante', 'Castellon',
  // Castilla y León (fuente ITACYL · añadida 11-jun-2026)
  'Avila', 'Burgos', 'Leon', 'Palencia', 'Salamanca', 'Segovia', 'Soria', 'Valladolid', 'Zamora',
] as const;
