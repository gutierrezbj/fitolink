import mongoose, { Schema, type Document } from 'mongoose';
import {
  ALERT_TYPES, ALERT_SEVERITIES, ALERT_STATUSES, ALERT_RESOLUTIONS,
  type AlertType, type AlertSeverity, type AlertStatus, type AlertResolution,
} from '@fitolink/shared';

/**
 * Feature snapshot used by the detector to flag this alert. Persisted only
 * when V2 (RandomForest) creates the alert — V1 threshold doesn't compute
 * features. This is the raw input for the retraining script that pairs
 * (features, resolvedBy) once the farmer/asesor closes the alert.
 *
 * Field names match `NdviFeatures` in
 * `workers/geo-pipeline/src/alerting/feature_extractor.py`. If the feature
 * vector evolves, bump `detectionModel` to a new version so old snapshots
 * aren't mixed with new ones during retraining.
 */
export interface AlertDetectionFeatures {
  current_ndvi: number;
  below_critical: number;
  delta_1: number;
  delta_3: number;
  delta_5: number;
  slope_3: number;
  slope_5: number;
  drop_from_recent_max: number;
  consecutive_drops: number;
  volatility: number;
  ndre_delta_1: number;
  seasonal_deviation: number;
  below_seasonal_min: number;
  month_sin: number;
  month_cos: number;
  crop_group_id: number;
  history_length: number;
}

export interface IAlert extends Document {
  parcelId: mongoose.Types.ObjectId;
  type: AlertType;
  severity: AlertSeverity;
  ndviValue: number;
  ndviDelta: number;
  detectedAt: Date;
  status: AlertStatus;
  aiConfidence: number;
  resolvedBy?: AlertResolution;
  imagery?: { sentinelScene: string; tileUrl?: string };
  // ML feedback loop · paso 2 (Sprint feedback loop, 13-may-2026).
  detectionFeatures?: AlertDetectionFeatures;
  detectionModel?: 'v1_threshold' | 'v2_random_forest';
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    parcelId: { type: Schema.Types.ObjectId, ref: 'Parcel', required: true, index: true },
    type: { type: String, enum: ALERT_TYPES, required: true },
    severity: { type: String, enum: ALERT_SEVERITIES, required: true },
    ndviValue: { type: Number, required: true },
    ndviDelta: { type: Number, required: true },
    detectedAt: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ALERT_STATUSES, default: 'new' },
    aiConfidence: { type: Number, required: true, min: 0, max: 1 },
    resolvedBy: { type: String, enum: ALERT_RESOLUTIONS },
    imagery: {
      sentinelScene: String,
      tileUrl: String,
    },
    // Feedback loop fields. Definidos como Mixed para no atarse al schema
    // exacto de NdviFeatures — si el feature vector cambia en el pipeline,
    // basta con incrementar detectionModel; el campo acepta nuevas claves.
    detectionFeatures: { type: Schema.Types.Mixed },
    detectionModel: { type: String, enum: ['v1_threshold', 'v2_random_forest'] },
  },
  {
    timestamps: true,
  },
);

alertSchema.index({ parcelId: 1, status: 1 });
alertSchema.index({ severity: 1, status: 1 });
alertSchema.index({ detectedAt: -1 });

export const Alert = mongoose.model<IAlert>('Alert', alertSchema);
