import { z } from 'zod';
import {
  USER_ROLES,
  OPERATION_TYPES,
  OPERATION_STATUSES,
  APPLICATION_UNITS,
  ALERT_TYPES,
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  ALERT_RESOLUTIONS,
  NDVI_SOURCES,
  CROP_TYPES,
  PROVIDER_CATEGORIES,
  LEAD_TYPES,
} from './constants.js';

// === GeoJSON ===

export const pointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
});

export const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

// === Users ===

export const certificationSchema = z.object({
  type: z.string().min(1),
  number: z.string().min(1),
  expiry: z.coerce.date(),
});

export const equipmentSchema = z.object({
  model: z.string().min(1),
  type: z.string().min(1),
  payloadKg: z.number().positive(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(USER_ROLES),
  phone: z.string().optional(),
  location: pointSchema.optional(),
  // Pilot-specific
  certifications: z.array(certificationSchema).optional(),
  equipment: z.array(equipmentSchema).optional(),
  operationalRadiusKm: z.number().positive().optional(),
  // Farmer-specific
  cooperativeId: z.string().optional(),
  // Insurer-specific
  company: z.string().optional(),
  contractId: z.string().optional(),
});

export const updateUserSchema = createUserSchema.partial().omit({ email: true, role: true });

// === Parcels ===

export const ndviReadingSchema = z.object({
  date: z.coerce.date(),
  mean: z.number(),
  min: z.number(),
  max: z.number(),
  anomalyDetected: z.boolean().default(false),
  source: z.enum(NDVI_SOURCES),
  ndreValue: z.number().optional(),
  ndmiValue: z.number().optional(),
  eviValue: z.number().optional(),
  saviValue: z.number().optional(),
  cloudFraction: z.number().optional(),
});

export const createParcelSchema = z.object({
  name: z.string().min(1).max(200),
  geometry: polygonSchema,
  areaHa: z.number().positive().min(0.1),
  cropType: z.enum(CROP_TYPES),
  province: z.string().min(1),
  sigpacRef: z.string().optional(),
  isInsured: z.boolean().default(false),
  insurerId: z.string().optional(),
  /**
   * Año de plantación del cultivo (opcional). Si está informado, el
   * sistema arranca calibrado y deduce establishmentPhase. Si no, la
   * parcela entra en modo Calibración pasiva durante CALIBRATION_DAYS.
   * Sprint Calibración del Cultivo · 14-may-2026.
   */
  plantingYear: z.number().int().min(1900).max(2100).optional(),
  /**
   * Override manual del agricultor o admin para indicar "cultivo joven
   * en establecimiento". Si viene, pisa la inferencia automática desde
   * plantingYear + ESTABLISHMENT_YEARS[cropType].
   */
  establishmentPhase: z.boolean().optional(),
});

export const updateParcelSchema = createParcelSchema.partial();

export const bulkCreateParcelSchema = z.object({
  parcels: z.array(createParcelSchema).min(1).max(100),
});

// === Operations ===

export const productSchema = z.object({
  name: z.string().min(1),
  activeSubstance: z.string().min(1),
  doseLPerHa: z.number().positive(),
});

// Producto de una aplicación (mezcla de tanque): nombre + dosis + unidad.
// Soporta sólidos (g/kg) y líquidos (mL/L). Reemplaza al productSchema de
// un solo producto para representar mezclas reales (p.ej. bioestimulante +
// microbiota) sin forzar "sustancia activa" (concepto de fitosanitario).
export const productItemSchema = z.object({
  name: z.string().min(1),
  dose: z.number().positive(),
  unit: z.enum(APPLICATION_UNITS),
  note: z.string().max(200).optional(),
});

export const weatherSchema = z.object({
  temp: z.number(),
  windKmh: z.number().min(0),
  humidity: z.number().min(0).max(100),
});

export const flightLogSchema = z.object({
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  areaHa: z.number().positive(),
});

export const createOperationSchema = z.object({
  parcelId: z.string(),
  type: z.enum(OPERATION_TYPES),
  alertId: z.string().optional(),
});

export const completeOperationSchema = z.object({
  product: productSchema.optional(),
  // Mezcla de tanque: varios productos con su dosis y unidad. Es el modo
  // preferido; `product` (un solo producto en L/ha) se mantiene por compat.
  products: z.array(productItemSchema).max(12).optional(),
  applicationMethod: z.string().optional(),
  weatherConditions: weatherSchema.optional(),
  flightLog: flightLogSchema,
  prescription: z.object({
    ref: z.string(),
    signedBy: z.string(),
  }).optional(),
});

export type ProductItem = z.infer<typeof productItemSchema>;

// === Alerts ===

export const createAlertSchema = z.object({
  parcelId: z.string(),
  type: z.enum(ALERT_TYPES),
  severity: z.enum(ALERT_SEVERITIES),
  ndviValue: z.number(),
  ndviDelta: z.number(),
  aiConfidence: z.number().min(0).max(1),
  imagery: z.object({
    sentinelScene: z.string(),
    tileUrl: z.string().url().optional(),
  }).optional(),
});

export const updateAlertSchema = z.object({
  status: z.enum(ALERT_STATUSES).optional(),
  resolvedBy: z.enum(ALERT_RESOLUTIONS).optional(),
});

// === Auth ===

export const loginGoogleSchema = z.object({
  credential: z.string().min(1),
});

export const registerSchema = z.object({
  credential: z.string().min(1),
  role: z.enum(USER_ROLES),
  phone: z.string().optional(),
  // T&C + privacidad — obligatorio para alta legal en EU (RGPD).
  // El cliente envía `true` y el ISO timestamp del momento del clic.
  // Opcional en el schema para compatibilidad con clientes antiguos pero
  // el authService los registra en User cuando vienen presentes.
  acceptedTerms: z.boolean().optional(),
  acceptedTermsAt: z.string().optional(),
});

// === Marketplace providers (directory entries — no login) ===

export const providerSchema = z.object({
  category: z.enum(PROVIDER_CATEGORIES),
  name: z.string().min(1).max(200),
  brand: z.string().max(200).optional(),
  description: z.string().max(500),
  location: pointSchema,
  serviceRadiusKm: z.number().positive().max(500).default(50),
  cropSpecialties: z.array(z.enum(CROP_TYPES)).default([]),
  contact: z.object({
    email: z.string().email().optional(),
    phone: z.string().max(40).optional(),
    website: z.string().url().optional(),
  }).default({}),
  certifications: z.array(z.string().max(60)).optional(),
  rating: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().min(0).default(0),
  isVerified: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
  // Cooperative-only metrics
  memberCount: z.number().int().positive().optional(),
  aggregateAreaHa: z.number().positive().optional(),
});

export const createLeadSchema = z.object({
  providerId: z.string().min(1),
  type: z.enum(LEAD_TYPES),
  message: z.string().max(2000).optional(),
});

// === Types ===

export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type CreateParcel = z.infer<typeof createParcelSchema>;
export type UpdateParcel = z.infer<typeof updateParcelSchema>;
export type BulkCreateParcel = z.infer<typeof bulkCreateParcelSchema>;
export type CreateOperation = z.infer<typeof createOperationSchema>;
export type CompleteOperation = z.infer<typeof completeOperationSchema>;
export type CreateAlert = z.infer<typeof createAlertSchema>;
export type UpdateAlert = z.infer<typeof updateAlertSchema>;
export type NdviReading = z.infer<typeof ndviReadingSchema>;
export type Certification = z.infer<typeof certificationSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;
export type GeoPoint = z.infer<typeof pointSchema>;
export type GeoPolygon = z.infer<typeof polygonSchema>;
export type CreateProvider = z.infer<typeof providerSchema>;
export type CreateLead = z.infer<typeof createLeadSchema>;
