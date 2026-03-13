import { Alert, type IAlert } from '../models/Alert.js';
import { Parcel } from '../models/Parcel.js';
import { AppError } from '../utils/AppError.js';
import type { CreateAlert, UpdateAlert } from '@fitolink/shared';

export async function createAlert(data: CreateAlert): Promise<IAlert> {
  const parcel = await Parcel.findById(data.parcelId);
  if (!parcel) throw AppError.notFound('Parcela');

  const alert = await Alert.create(data);
  return alert;
}

export async function getAlertsByParcel(parcelId: string): Promise<IAlert[]> {
  return Alert.find({ parcelId }).sort({ detectedAt: -1 });
}

export async function getAlertsByUser(userId: string): Promise<IAlert[]> {
  const parcels = await Parcel.find({ ownerId: userId, isActive: true }).select('_id');
  const parcelIds = parcels.map((p) => p._id);
  return Alert.find({ parcelId: { $in: parcelIds } })
    .sort({ detectedAt: -1 })
    .populate('parcelId', 'name cropType province');
}

export async function getActiveAlerts(page = 1, limit = 50): Promise<{ alerts: IAlert[]; total: number }> {
  const skip = (page - 1) * limit;
  const filter = { status: { $in: ['new', 'notified'] } };
  const [alerts, total] = await Promise.all([
    Alert.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ severity: -1, detectedAt: -1 })
      .populate('parcelId', 'name cropType province ownerId'),
    Alert.countDocuments(filter),
  ]);
  return { alerts, total };
}

export async function updateAlert(alertId: string, data: UpdateAlert): Promise<IAlert> {
  const alert = await Alert.findByIdAndUpdate(alertId, data, { new: true });
  if (!alert) throw AppError.notFound('Alerta');
  return alert;
}
