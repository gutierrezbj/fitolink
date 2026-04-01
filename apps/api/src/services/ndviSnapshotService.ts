import { NdviSnapshot, type INdviSnapshot } from '../models/NdviSnapshot.js';
import { Parcel } from '../models/Parcel.js';
import { AppError } from '../utils/AppError.js';

/**
 * Return the most recent NDVI grid snapshot for a parcel.
 * Verifies the requesting user owns the parcel (or is an insurer/admin).
 */
export async function getLatestSnapshot(
  parcelId: string,
  userId: string,
  userRole: string,
): Promise<Record<string, unknown> | null> {
  // Authorisation: farmers can only access their own parcels
  if (userRole === 'farmer') {
    const parcel = await Parcel.findById(parcelId);
    if (!parcel || !parcel.isActive) throw AppError.notFound('Parcela');
    if (parcel.ownerId.toString() !== userId) {
      throw AppError.forbidden('No tienes acceso a esta parcela');
    }
  }

  const snapshot = await NdviSnapshot.findOne({ parcelId })
    .sort({ date: -1 })
    .lean();

  return snapshot as Record<string, unknown> | null;
}
