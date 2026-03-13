// User roles
export const USER_ROLES = ['farmer', 'pilot', 'agronomist', 'insurer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Operation types
export const OPERATION_TYPES = ['phytosanitary', 'inspection', 'diagnosis'] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

// Operation statuses
export const OPERATION_STATUSES = ['requested', 'assigned', 'in_progress', 'completed', 'cancelled'] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

// Alert types
export const ALERT_TYPES = ['ndvi_drop', 'ndre_anomaly', 'stress_pattern'] as const;
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
] as const;
