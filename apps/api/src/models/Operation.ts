import mongoose, { Schema, type Document } from 'mongoose';
import {
  OPERATION_TYPES, OPERATION_STATUSES,
  type OperationType, type OperationStatus,
} from '@fitolink/shared';

export interface IOperation extends Document {
  parcelId: mongoose.Types.ObjectId;
  farmerId: mongoose.Types.ObjectId;
  pilotId?: mongoose.Types.ObjectId;
  agronomistId?: mongoose.Types.ObjectId;
  type: OperationType;
  status: OperationStatus;
  alertId?: mongoose.Types.ObjectId;
  product?: { name: string; activeSubstance: string; doseLPerHa: number };
  applicationMethod?: string;
  weatherConditions?: { temp: number; windKmh: number; humidity: number };
  flightLog?: { startTime: Date; endTime: Date; areaHa: number };
  prescription?: { ref: string; signedBy: string };
  reportUrl?: string;
  rating?: { farmer: number; pilot: number; farmerComment?: string; pilotComment?: string };
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const operationSchema = new Schema<IOperation>(
  {
    parcelId: { type: Schema.Types.ObjectId, ref: 'Parcel', required: true },
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pilotId: { type: Schema.Types.ObjectId, ref: 'User' },
    agronomistId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: OPERATION_TYPES, required: true },
    status: { type: String, enum: OPERATION_STATUSES, default: 'requested' },
    alertId: { type: Schema.Types.ObjectId, ref: 'Alert' },
    product: {
      name: String,
      activeSubstance: String,
      doseLPerHa: Number,
    },
    applicationMethod: String,
    weatherConditions: {
      temp: Number,
      windKmh: Number,
      humidity: Number,
    },
    flightLog: {
      startTime: Date,
      endTime: Date,
      areaHa: Number,
    },
    prescription: {
      ref: String,
      signedBy: String,
    },
    reportUrl: String,
    rating: {
      farmer: Number,
      pilot: Number,
      farmerComment: String,
      pilotComment: String,
    },
    completedAt: Date,
  },
  {
    timestamps: true,
  },
);

operationSchema.index({ farmerId: 1, status: 1 });
operationSchema.index({ pilotId: 1, status: 1 });
operationSchema.index({ parcelId: 1, createdAt: -1 });

export const Operation = mongoose.model<IOperation>('Operation', operationSchema);
