import mongoose, { Schema, type Document } from 'mongoose';
import {
  ALERT_TYPES, ALERT_SEVERITIES, ALERT_STATUSES, ALERT_RESOLUTIONS,
  type AlertType, type AlertSeverity, type AlertStatus, type AlertResolution,
} from '@fitolink/shared';

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
  },
  {
    timestamps: true,
  },
);

alertSchema.index({ parcelId: 1, status: 1 });
alertSchema.index({ severity: 1, status: 1 });
alertSchema.index({ detectedAt: -1 });

export const Alert = mongoose.model<IAlert>('Alert', alertSchema);
