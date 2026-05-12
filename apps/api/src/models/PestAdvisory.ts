import mongoose, { Schema, type Document } from 'mongoose';
import { CROP_TYPES, PROVINCES, type CropType } from '@fitolink/shared';

/**
 * Pest advisory — Camino B of the "plagas curadas" pattern from
 * OverWatch v2 §5.x.
 *
 * The agronomist (or temporarily JuanCho himself) reads the official
 * bulletins published every week by RAIF Andalucia, MAPA, SAIF Valencia,
 * SIAM Murcia and similar regional services. When something relevant for
 * a covered comarca + crop appears, they create a row here. The system
 * then distributes it automatically to the parcels that match by crop
 * type and geographic radius around any of the affected centroids.
 *
 * We deliberately avoid trying to scrape and parse those PDFs — that
 * is V2. The wedge value here is the curated distribution, not the
 * scraping pipeline.
 */

export const PEST_SEVERITIES = ['low', 'medium', 'high'] as const;
export type PestSeverity = (typeof PEST_SEVERITIES)[number];

export const PEST_SOURCES = ['RAIF', 'MAPA', 'SAIF', 'SIAM', 'CSCV', 'otros'] as const;
export type PestSource = (typeof PEST_SOURCES)[number];

export interface IAffectedArea {
  /** Province from the canonical list (see PROVINCES) */
  province: typeof PROVINCES[number];
  /** Optional comarca name as it appears in the bulletin */
  comarca?: string;
  /** Reference point [lng, lat] used for radius matching */
  centroid: { type: 'Point'; coordinates: [number, number] };
  /** Match radius around the centroid, in kilometers */
  radiusKm: number;
}

export interface IPestAdvisory extends Document {
  /** Plant pest / disease canonical name (Spanish) */
  pestName: string;
  /** Optional scientific name */
  scientificName?: string;
  /** Crop types this advisory applies to */
  cropTypes: CropType[];
  /** One or more zones the advisory covers */
  affectedAreas: IAffectedArea[];
  severity: PestSeverity;
  /** Date when the activity started being reported */
  detectedAt: Date;
  /** Date after which the advisory is no longer active */
  expiresAt: Date;
  /** Origin of the curated information */
  source: PestSource;
  /** Bulletin reference (e.g. "RAIF Andalucia 19/2026") */
  sourceRef?: string;
  /** Recommended action — short, Tipo A friendly */
  recommendation?: string;
  /** Free-form notes (for the agronomist / operator) */
  notes?: string;
  /** Optional URL to the original bulletin */
  sourceUrl?: string;
  /** Who created the advisory (User._id) */
  createdBy: mongoose.Types.ObjectId;
  /** Whether the advisory is currently distributable */
  isActive: boolean;
  /** Idempotency fingerprint to prevent accidental duplicates */
  fingerprint: string;
  createdAt: Date;
  updatedAt: Date;
}

const affectedAreaSchema = new Schema<IAffectedArea>(
  {
    province: { type: String, enum: PROVINCES, required: true },
    comarca: { type: String, trim: true, maxlength: 80 },
    centroid: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: { type: [Number], required: true },
    },
    radiusKm: { type: Number, required: true, min: 1, max: 200, default: 30 },
  },
  { _id: false },
);

const pestAdvisorySchema = new Schema<IPestAdvisory>(
  {
    pestName: { type: String, required: true, trim: true, maxlength: 120, index: true },
    scientificName: { type: String, trim: true, maxlength: 120 },
    cropTypes: [{ type: String, enum: CROP_TYPES, required: true }],
    affectedAreas: { type: [affectedAreaSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    severity: { type: String, enum: PEST_SEVERITIES, default: 'medium' },
    detectedAt: { type: Date, required: true, default: Date.now },
    expiresAt: {
      type: Date,
      required: true,
      // Default expiry: 21 days from detectedAt — fits a typical bulletin
      // cycle plus a buffer so a single advisory survives the next week's
      // pipeline run without being treated as "stale".
      default: function () {
        return new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
      },
    },
    source: { type: String, enum: PEST_SOURCES, required: true },
    sourceRef: { type: String, trim: true, maxlength: 200 },
    recommendation: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 1000 },
    sourceUrl: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true, index: true },
    fingerprint: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true },
);

// Composite index: pull active advisories that overlap today, ordered by severity
pestAdvisorySchema.index({ isActive: 1, expiresAt: 1, severity: -1 });
// Geo index on each affected area centroid (one entry per area subdoc)
pestAdvisorySchema.index({ 'affectedAreas.centroid': '2dsphere' });

export const PestAdvisory = mongoose.model<IPestAdvisory>('PestAdvisory', pestAdvisorySchema);
