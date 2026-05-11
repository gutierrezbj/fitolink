import { Alert, type IAlert } from '../models/Alert.js';
import { Parcel } from '../models/Parcel.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { sendAlertEmail } from './emailService.js';
import { logger } from '../utils/logger.js';
import type { CreateAlert, UpdateAlert } from '@fitolink/shared';

export async function createAlert(data: CreateAlert): Promise<IAlert> {
  const parcel = await Parcel.findById(data.parcelId);
  if (!parcel) throw AppError.notFound('Parcela');

  const alert = await Alert.create(data);

  // Fire-and-forget email notification for actionable severities only.
  // Errors swallowed inside emailService; this never blocks the API response.
  if (alert.severity === 'critical' || alert.severity === 'high') {
    notifyOwnerByEmail(alert, parcel).catch((err) => {
      logger.warn({ err, alertId: alert._id }, 'Alert email notification failed (non-blocking)');
    });
  }

  return alert;
}

/**
 * Looks up the parcel owner and sends the alert email asynchronously.
 * Kept separate from createAlert so the email side-effect is explicit.
 */
async function notifyOwnerByEmail(alert: IAlert, parcel: { _id: unknown; name: string; province?: string; cropType?: string; ownerId: unknown; recentClimate?: { droughtFlag?: string | null } }): Promise<void> {
  const owner = await User.findById(parcel.ownerId).select('name email').lean();
  if (!owner?.email) {
    logger.info({ parcelId: parcel._id }, 'Skipping alert email — owner has no email');
    return;
  }

  await sendAlertEmail({
    to: owner.email,
    recipientName: owner.name ?? 'agricultor',
    parcelId: String(parcel._id),
    parcelName: parcel.name,
    parcelProvince: parcel.province,
    cropType: parcel.cropType,
    severity: alert.severity,
    ndviValue: alert.ndviValue,
    ndviDelta: alert.ndviDelta,
    aiConfidence: alert.aiConfidence,
    detectedAt: alert.detectedAt,
    alertType: alert.type,
    droughtFlag: parcel.recentClimate?.droughtFlag ?? null,
  });
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
