import { Operation, type IOperation } from '../models/Operation.js';
import { Parcel } from '../models/Parcel.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import type { CreateOperation, CompleteOperation } from '@fitolink/shared';

export async function createOperation(farmerId: string, data: CreateOperation): Promise<IOperation> {
  const parcel = await Parcel.findById(data.parcelId);
  if (!parcel) throw AppError.notFound('Parcela');
  if (parcel.ownerId.toString() !== farmerId) throw AppError.forbidden('No eres el propietario de esta parcela');

  const operation = await Operation.create({
    ...data,
    farmerId,
    status: 'requested',
  });

  // Auto-assign nearest verified pilot
  try {
    let pilot = null;
    // Try geospatial match first (within 100km of parcel centroid)
    if (parcel.geometry?.coordinates?.length) {
      const coords = parcel.geometry.coordinates[0] as Array<[number, number]>;
      const sum = coords.reduce(
        (acc, c) => [acc[0] + c[0], acc[1] + c[1]] as [number, number],
        [0, 0] as [number, number],
      );
      const centroid: [number, number] = [sum[0] / coords.length, sum[1] / coords.length];

      pilot = await User.findOne({
        role: 'pilot',
        isVerified: true,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: centroid },
            $maxDistance: 100_000,
          },
        },
      });
    }
    // Fallback: any verified pilot
    if (!pilot) {
      pilot = await User.findOne({ role: 'pilot', isVerified: true });
    }
    if (pilot) {
      operation.pilotId = pilot._id;
      operation.status = 'assigned';
      await operation.save();
    }
  } catch {
    // Non-critical: operation stays in 'requested' if assignment fails
  }

  return operation;
}

export async function getOperationsByFarmer(farmerId: string): Promise<IOperation[]> {
  return Operation.find({ farmerId })
    .sort({ createdAt: -1 })
    .populate('parcelId', 'name cropType province')
    .populate('pilotId', 'name email rating')
    .populate('alertId', 'type severity ndviValue');
}

export async function getOperationsByPilot(pilotId: string): Promise<IOperation[]> {
  return Operation.find({ pilotId })
    .sort({ createdAt: -1 })
    .populate('parcelId', 'name cropType province areaHa')
    .populate('farmerId', 'name email phone');
}

export async function getOperationById(operationId: string, userId: string): Promise<IOperation> {
  const operation = await Operation.findById(operationId)
    .populate('parcelId', 'name cropType province areaHa geometry')
    .populate('farmerId', 'name email phone')
    .populate('pilotId', 'name email phone rating')
    .populate('alertId', 'type severity ndviValue ndviDelta');

  if (!operation) throw AppError.notFound('Operacion');

  const isOwner = operation.farmerId._id?.toString() === userId
    || operation.pilotId?._id?.toString() === userId;
  if (!isOwner) throw AppError.forbidden('No tienes acceso a esta operacion');

  return operation;
}

export async function updateOperationStatus(
  operationId: string,
  userId: string,
  status: string,
): Promise<IOperation> {
  const operation = await Operation.findById(operationId);
  if (!operation) throw AppError.notFound('Operacion');

  const isOwner = operation.farmerId.toString() === userId
    || operation.pilotId?.toString() === userId;
  if (!isOwner) throw AppError.forbidden('No tienes acceso a esta operacion');

  operation.status = status as IOperation['status'];
  if (status === 'completed') {
    operation.completedAt = new Date();
  }
  await operation.save();
  return operation;
}

export async function completeOperation(
  operationId: string,
  pilotId: string,
  data: CompleteOperation,
): Promise<IOperation> {
  const operation = await Operation.findById(operationId);
  if (!operation) throw AppError.notFound('Operacion');
  if (operation.pilotId?.toString() !== pilotId) {
    throw AppError.forbidden('Solo el piloto asignado puede completar la operacion');
  }

  operation.status = 'completed';
  operation.completedAt = new Date();
  if (data.product) operation.product = data.product;
  if (data.applicationMethod) operation.applicationMethod = data.applicationMethod;
  if (data.weatherConditions) operation.weatherConditions = data.weatherConditions;
  if (data.flightLog) operation.flightLog = data.flightLog;
  if (data.prescription) operation.prescription = data.prescription;
  await operation.save();
  return operation;
}

export async function getOperationCountByFarmer(farmerId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  return Operation.countDocuments({ farmerId, createdAt: { $gte: startOfMonth } });
}
