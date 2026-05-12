import { Parcel, type IParcel } from '../models/Parcel.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { sendFirstParcelEmail } from './emailService.js';
import { logger } from '../utils/logger.js';
import type { CreateParcel, UpdateParcel } from '@fitolink/shared';

/**
 * Fire-and-forget: si esta es la primera parcela activa del usuario,
 * mandar el email "procesando" para que sepa qué esperar. Idempotente
 * por estado de la BD — si ya tenía parcelas no se manda.
 */
async function maybeSendFirstParcelEmail(ownerId: string, justCreated: IParcel | IParcel[]): Promise<void> {
  try {
    // Count parcels for the user. If exactly the count we just created → first time.
    const totalNow = await Parcel.countDocuments({ ownerId, isActive: true });
    const createdCount = Array.isArray(justCreated) ? justCreated.length : 1;
    if (totalNow !== createdCount) return; // ya tenía otras → no es la primera vez

    const user = await User.findById(ownerId).lean();
    if (!user) return;

    // Usamos la primera (más significativa) si bulk.
    const firstParcel = Array.isArray(justCreated) ? justCreated[0] : justCreated;
    void sendFirstParcelEmail({
      to: user.email,
      recipientName: user.name,
      parcelName: firstParcel.name,
      cropType: firstParcel.cropType,
      province: firstParcel.province,
      areaHa: firstParcel.areaHa ?? 0,
    });
  } catch (err) {
    logger.warn({ err, ownerId }, 'maybeSendFirstParcelEmail check failed (no-op)');
  }
}

export async function createParcel(ownerId: string, data: CreateParcel): Promise<IParcel> {
  const parcel = await Parcel.create({
    ...data,
    ownerId,
  });
  void maybeSendFirstParcelEmail(ownerId, parcel);
  return parcel;
}

export async function createParcelsBulk(
  ownerId: string,
  parcels: CreateParcel[],
): Promise<IParcel[]> {
  // insertMany is a single round-trip and atomic at the DB level. If one
  // doc fails validation, none are inserted (ordered: true is the default).
  const docs = parcels.map((p) => ({ ...p, ownerId }));
  const created = await Parcel.insertMany(docs, { ordered: true });
  const createdArr = created as unknown as IParcel[];
  void maybeSendFirstParcelEmail(ownerId, createdArr);
  return createdArr;
}

export async function getParcelsByOwner(ownerId: string): Promise<IParcel[]> {
  return Parcel.find({ ownerId, isActive: true }).sort({ createdAt: -1 });
}

export async function getParcelById(
  parcelId: string,
  userId: string,
  // Allow admin to read any parcel without ownership check (analytics top-5
  // drill-down, dispatcher). Mutations (update/delete) keep strict ownership
  // — only the dedicated update/delete services call this with strict mode.
  options: { allowAdminRead?: boolean; userRole?: string } = {},
): Promise<IParcel> {
  const parcel = await Parcel.findById(parcelId);
  if (!parcel || !parcel.isActive) {
    throw AppError.notFound('Parcela');
  }
  const isOwner = parcel.ownerId.toString() === userId;
  const isAdminRead = options.allowAdminRead === true && options.userRole === 'admin';
  // Insurer can read any parcel that's in their cartera (isInsured + insurerId match)
  const isInsurerCartera =
    options.userRole === 'insurer' &&
    parcel.isInsured === true &&
    parcel.insurerId?.toString() === userId;

  if (!isOwner && !isAdminRead && !isInsurerCartera) {
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
