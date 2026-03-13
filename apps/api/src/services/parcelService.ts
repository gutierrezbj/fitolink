import { Parcel, type IParcel } from '../models/Parcel.js';
import { AppError } from '../utils/AppError.js';
import type { CreateParcel, UpdateParcel } from '@fitolink/shared';

export async function createParcel(ownerId: string, data: CreateParcel): Promise<IParcel> {
  const parcel = await Parcel.create({
    ...data,
    ownerId,
  });
  return parcel;
}

export async function getParcelsByOwner(ownerId: string): Promise<IParcel[]> {
  return Parcel.find({ ownerId, isActive: true }).sort({ createdAt: -1 });
}

export async function getParcelById(parcelId: string, userId: string): Promise<IParcel> {
  const parcel = await Parcel.findById(parcelId);
  if (!parcel || !parcel.isActive) {
    throw AppError.notFound('Parcela');
  }
  if (parcel.ownerId.toString() !== userId) {
    throw AppError.forbidden('No tienes acceso a esta parcela');
  }
  return parcel;
}

export async function updateParcel(
  parcelId: string,
  userId: string,
  data: UpdateParcel,
): Promise<IParcel> {
  const parcel = await getParcelById(parcelId, userId);
  Object.assign(parcel, data);
  await parcel.save();
  return parcel;
}

export async function deleteParcel(parcelId: string, userId: string): Promise<void> {
  const parcel = await getParcelById(parcelId, userId);
  parcel.isActive = false;
  await parcel.save();
}

export async function getAllParcels(page = 1, limit = 50): Promise<{ parcels: IParcel[]; total: number }> {
  const skip = (page - 1) * limit;
  const [parcels, total] = await Promise.all([
    Parcel.find({ isActive: true }).skip(skip).limit(limit).populate('ownerId', 'name email'),
    Parcel.countDocuments({ isActive: true }),
  ]);
  return { parcels, total };
}

export async function getInsuredParcels(insurerId: string): Promise<IParcel[]> {
  return Parcel.find({ insurerId, isInsured: true, isActive: true })
    .populate('ownerId', 'name email phone');
}

export async function getNdviHistory(parcelId: string, userId: string) {
  const parcel = await Parcel.findById(parcelId);
  if (!parcel) throw AppError.notFound('Parcela');
  return parcel.ndviHistory;
}
