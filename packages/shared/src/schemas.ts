import { z } from 'zod';
import {
  USER_ROLES,
  OPERATION_TYPES,
  OPERATION_STATUSES,
  ALERT_TYPES,
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  ALERT_RESOLUTIONS,
  NDVI_SOURCES,
  CROP_TYPES,
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
});

export const updateParcelSchema = createParcelSchema.partial();

// === Operations ===

export const productSchema = z.object({
  name: z.string().min(1),
  activeSubstance: z.string().min(1),
  doseLPerHa: z.number().positive(),
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
  applicationMethod: z.string().optional(),
  weatherConditions: weatherSchema.optional(),
  flightLog: flightLogSchema,
  prescription: z.object({
    ref: z.string(),
    signedBy: z.string(),
  }).optional(),
});

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
});

// === Types ===

export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type CreateParcel = z.infer<typeof createParcelSchema>;
export type UpdateParcel = z.infer<typeof updateParcelSchema>;
export type CreateOperation = z.infer<typeof createOperationSchema>;
export type CompleteOperation = z.infer<typeof completeOperationSchema>;
export type CreateAlert = z.infer<typeof createAlertSchema>;
export type UpdateAlert = z.infer<typeof updateAlertSchema>;
export type NdviReading = z.infer<typeof ndviReadingSchema>;
export type Certification = z.infer<typeof certificationSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;
export type GeoPoint = z.infer<typeof pointSchema>;
export type GeoPolygon = z.infer<typeof polygonSchema>;
