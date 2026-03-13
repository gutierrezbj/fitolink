import mongoose, { Schema, type Document } from 'mongoose';
import { CROP_TYPES, NDVI_SOURCES, type CropType, type NdviSource } from '@fitolink/shared';

export interface INdviReading {
  date: Date;
  mean: number;
  min: number;
  max: number;
  anomalyDetected: boolean;
  source: NdviSource;
}

export interface IParcel extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  areaHa: number;
  cropType: CropType;
  province: string;
  sigpacRef?: string;
  isInsured: boolean;
  insurerId?: mongoose.Types.ObjectId;
  ndviHistory: INdviReading[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ndviReadingSchema = new Schema<INdviReading>(
  {
    date: { type: Date, required: true },
    mean: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    anomalyDetected: { type: Boolean, default: false },
    source: { type: String, enum: NDVI_SOURCES, required: true },
  },
  { _id: false },
);

const parcelSchema = new Schema<IParcel>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    geometry: {
      type: { type: String, enum: ['Polygon'], required: true },
      coordinates: { type: [[[Number]]], required: true },
    },
    areaHa: { type: Number, required: true, min: 0.1 },
    cropType: { type: String, enum: CROP_TYPES, required: true },
    province: { type: String, required: true },
    sigpacRef: String,
    isInsured: { type: Boolean, default: false },
    insurerId: { type: Schema.Types.ObjectId, ref: 'User' },
    ndviHistory: [ndviReadingSchema],
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

parcelSchema.index({ geometry: '2dsphere' });
parcelSchema.index({ ownerId: 1, isActive: 1 });
parcelSchema.index({ isInsured: 1, insurerId: 1 });

export const Parcel = mongoose.model<IParcel>('Parcel', parcelSchema);
