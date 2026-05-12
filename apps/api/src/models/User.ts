import mongoose, { Schema, type Document } from 'mongoose';
import { USER_ROLES, type UserRole } from '@fitolink/shared';

export interface IUser extends Document {
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  googleId: string;
  location?: { type: 'Point'; coordinates: [number, number] };
  // Pilot-specific
  certifications?: Array<{ type: string; number: string; expiry: Date }>;
  equipment?: Array<{ model: string; type: string; payloadKg: number }>;
  operationalRadiusKm?: number;
  isVerified: boolean;
  rating: number;
  ratingCount: number;
  // Farmer-specific — links the farmer to a User with role='cooperative'
  // when they're a socio of a cooperative. Cooperative dashboards aggregate
  // parcels of all users with this field pointing to them.
  cooperativeId?: mongoose.Types.ObjectId;
  // Insurer-specific
  company?: string;
  contractId?: string;
  // Morning digest (Ola 1.5 · Pieza 4) — opt-in flag + idempotency stamp.
  // digestSubscribed defaults true for farmer/cooperative roles. The cron
  // reads lastDigestSentAt and skips users already served today, so reruns
  // of sendMorningDigest the same day are no-ops (idempotent).
  digestSubscribed?: boolean;
  lastDigestSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: USER_ROLES },
    phone: { type: String },
    avatar: { type: String },
    googleId: { type: String, required: true, unique: true },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    certifications: [{
      type: { type: String },
      number: String,
      expiry: Date,
    }],
    equipment: [{
      model: String,
      type: { type: String },
      payloadKg: Number,
    }],
    operationalRadiusKm: Number,
    isVerified: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    cooperativeId: { type: Schema.Types.ObjectId, ref: 'User' },
    company: String,
    contractId: String,
    digestSubscribed: { type: Boolean, default: true },
    lastDigestSentAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ location: '2dsphere' });
userSchema.index({ role: 1, isVerified: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
