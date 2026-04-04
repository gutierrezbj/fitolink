import mongoose, { Schema, Document } from 'mongoose';

export interface INdviPoint {
  lat: number;
  lng: number;
  ndvi: number;
}

export interface INdviSnapshot extends Document {
  parcelId: mongoose.Types.ObjectId;
  date: Date;
  resolution: number;
  points: INdviPoint[];
  bbox: [number, number, number, number]; // [west, south, east, north]
  pixelCount: number;
  createdAt: Date;
}

const ndviPointSchema = new Schema<INdviPoint>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    ndvi: { type: Number, required: true },
  },
  { _id: false },
);

const ndviSnapshotSchema = new Schema<INdviSnapshot>(
  {
    parcelId: { type: Schema.Types.ObjectId, ref: 'Parcel', required: true, index: true },
    date: { type: Date, required: true },
    resolution: { type: Number, default: 20 },
    points: { type: [ndviPointSchema], default: [] },
    bbox: { type: [Number], required: true },
    pixelCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ndviSnapshotSchema.index({ parcelId: 1, date: -1 });

export const NdviSnapshot = mongoose.model<INdviSnapshot>('NdviSnapshot', ndviSnapshotSchema, 'ndvi_snapshots');
