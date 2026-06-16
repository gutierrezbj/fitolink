import { NdviSnapshot, type INdviSnapshot } from '../models/NdviSnapshot.js';
import { getParcelById } from './parcelService.js';

/**
 * Return the most recent NDVI grid snapshot for a parcel.
 * Verifies the requesting user owns the parcel (or is an insurer/admin/aggregator).
 */
export async function getLatestSnapshot(
  parcelId: string,
  userId: string,
  userRole: string,
): Promise<Record<string, unknown> | null> {
  // Fail closed para TODOS los roles. Antes solo se validaba a 'farmer':
  // insurer/admin/coop/adv/regantes pasaban sin check → leían el snapshot
  // NDVI de cualquier parcela. Reusa la misma lógica que el detalle.
  await getParcelById(parcelId, userId, { allowAdminRead: true, userRole });

  const snapshot = await NdviSnapshot.findOne({ parcelId })
    .sort({ date: -1 })
    .lean();

  return snapshot as Record<string, unknown> | null;
}
