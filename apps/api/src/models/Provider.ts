import mongoose, { Schema, type Document } from 'mongoose';
import {
  PROVIDER_CATEGORIES,
  CROP_TYPES,
  type ProviderCategory,
  type CropType,
} from '@fitolink/shared';

/**
 * Marketplace provider — directory entry without login.
 *
 * Represents distributors, agronomic advisors, and cooperatives that the
 * agricultor needs to discover but who do NOT use FitoLink directly. Pilots
 * stay in the User collection because they operate the platform actively.
 *
 * Cooperatives use the same shape but populate `memberCount` and
 * `aggregateAreaHa` so the UI can render the bigger "PROGRAMA" card and
 * surface the strategic lead-capture CTA.
 */

export interface IProviderContact {
  email?: string;
  phone?: string;
  website?: string;
}

export interface IProvider extends Document {
  category: ProviderCategory;
  name: string;
  brand?: string;
  description: string;
  location: { type: 'Point'; coordinates: [number, number] };
  serviceRadiusKm: number;
  cropSpecialties: CropType[];
  contact: IProviderContact;
  certifications?: string[];
  rating: number;
  ratingCount: number;
  isVerified: boolean;
  notes?: string;
  // Cooperative-only metrics — kept on the same model to avoid an extra
  // collection. Other categories simply leave them undefined.
  memberCount?: number;
  aggregateAreaHa?: number;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IProviderContact>(
  {
    email: { type: String },
    phone: { type: String },
    website: { type: String },
  },
  { _id: false },
);

const providerSchema = new Schema<IProvider>(
  {
    category: { type: String, enum: PROVIDER_CATEGORIES, required: true, index: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    serviceRadiusKm: { type: Number, required: true, min: 1, max: 500, default: 50 },
    cropSpecialties: [{ type: String, enum: CROP_TYPES }],
    contact: { type: contactSchema, default: () => ({}) },
    certifications: [{ type: String, trim: true }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    isVerified: { type: Boolean, default: true },
    notes: { type: String },
    memberCount: { type: Number, min: 1 },
    aggregateAreaHa: { type: Number, min: 1 },
  },
  { timestamps: true },
);

providerSchema.index({ location: '2dsphere' });
providerSchema.index({ category: 1, isVerified: 1 });

export const Provider = mongoose.model<IProvider>('Provider', providerSchema);
