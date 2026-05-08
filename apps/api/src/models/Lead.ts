import mongoose, { Schema, type Document } from 'mongoose';
import {
  LEAD_TYPES,
  LEAD_STATUSES,
  type LeadType,
  type LeadStatus,
} from '@fitolink/shared';

/**
 * Lead — captured commercial interest from the marketplace.
 *
 * V1 use case: the agricultor clicks "Solicitar programa cooperativa" on a
 * cooperative card → a Lead row is created with `type='cooperative-program'`
 * and the team closes it manually. Future iterations may add admin views
 * and lifecycle automation, but for now we just need the row to exist.
 */

export interface ILead extends Document {
  providerId: mongoose.Types.ObjectId;
  fromUserId: mongoose.Types.ObjectId;
  type: LeadType;
  status: LeadStatus;
  message?: string;
  fromUserSnapshot: {
    name: string;
    email: string;
    phone?: string;
    role: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: LEAD_TYPES, required: true, index: true },
    status: { type: String, enum: LEAD_STATUSES, default: 'new', index: true },
    message: { type: String, trim: true, maxlength: 2000 },
    // Snapshot of the requesting user — keeps the lead useful even if the
    // user later edits or deletes their profile.
    fromUserSnapshot: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String },
      role: { type: String, required: true },
    },
  },
  { timestamps: true },
);

leadSchema.index({ status: 1, createdAt: -1 });

export const Lead = mongoose.model<ILead>('Lead', leadSchema);
