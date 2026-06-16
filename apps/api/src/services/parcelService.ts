import { Parcel, type IParcel } from '../models/Parcel.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { sendFirstParcelEmail } from './emailService.js';
import { fetchSoilProfileForParcel } from './soilService.js';
import { logger } from '../utils/logger.js';
import {
  CALIBRATION_DAYS,
  inferEstablishmentFromAge,
  type CreateParcel,
  type UpdateParcel,
} from '@fitolink/shared';

/**
 * Fire-and-forget: si esta es la primera parcela activa del usuario,
 * mandar el email "procesando" para que sepa qué esperar. Idempotente
 * por estado de la BD — si ya tenía parcelas no se manda.
 */
/**
 * Sprint SoilGrids — fetch fire-and-forget del perfil edáfico al crear
 * la parcela. No bloquea la respuesta al usuario; si la API ISRIC está
 * caída o devuelve datos incompletos, se persiste sin soil y el usuario
 * puede dispararlo manualmente vía POST /parcels/:id/soil/refresh.
 */
async function maybePopulateSoil(parcel: IParcel | IParcel[]): Promise<void> {
  const parcels = Array.isArray(parcel) ? parcel : [parcel];
  for (const p of parcels) {
    try {
      const profile = await fetchSoilProfileForParcel(p);
      await Parcel.updateOne({ _id: p._id }, { $set: { soil: profile } });
      logger.info(
        { parcelId: p._id.toString(), texture: profile.dominantTexture },
        'soil_profile_auto_populated',
      );
    } catch (err) {
      logger.warn(
        { err, parcelId: p._id.toString() },
        'soil_profile_auto_populate_failed (refresh disponible vía endpoint manual)',
      );
    }
  }
}

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

/**
 * Aplica la lógica de calibración inicial cuando se crea una parcela:
 *
 *  · Si el agricultor informó `plantingYear`, el sistema arranca
 *    calibrado. Inferimos `establishmentPhase` automáticamente desde
 *    la tabla ESTABLISHMENT_YEARS y dejamos `calibratingUntil = null`.
 *    El override manual del usuario (si vino `establishmentPhase`
 *    explícito en el payload) siempre gana sobre el cálculo automático.
 *
 *  · Si NO informó `plantingYear`, entra en modo Calibración pasiva
 *    durante CALIBRATION_DAYS días. Pipeline, badges y digest se
 *    suavizan mientras tanto, hasta que el agricultor edite los datos
 *    del cultivo o pase el plazo. `establishmentPhase` queda en false
 *    por defecto — no asumimos lo peor sin info.
 *
 * Sprint Calibración del Cultivo · 14-may-2026.
 */
function applyCalibrationOnCreate(data: CreateParcel): Partial<IParcel> {
  const out: Partial<IParcel> = {};

  // Establishment inference desde plantingYear + cropType
  if (data.plantingYear !== undefined && data.plantingYear !== null) {
    const inferred = inferEstablishmentFromAge(data.cropType, data.plantingYear);
    // Override manual gana: si el usuario explícitamente marcó establishmentPhase
    // en el payload, respetamos su decisión. Si no, usamos la inferencia.
    if (data.establishmentPhase === undefined && inferred !== undefined) {
      out.establishmentPhase = inferred;
    }
    out.calibratingUntil = null; // Sistema calibrado, no necesita observar pasivo
  } else {
    // Sin plantingYear → modo Calibración pasiva
    const until = new Date();
    until.setUTCDate(until.getUTCDate() + CALIBRATION_DAYS);
    out.calibratingUntil = until;
  }

  return out;
}

export async function createParcel(ownerId: string, data: CreateParcel): Promise<IParcel> {
  const parcel = await Parcel.create({
    ...data,
    ...applyCalibrationOnCreate(data),
    ownerId,
  });
  void maybeSendFirstParcelEmail(ownerId, parcel);
  void maybePopulateSoil(parcel);
  return parcel;
}

export async function createParcelsBulk(
  ownerId: string,
  parcels: CreateParcel[],
): Promise<IParcel[]> {
  // insertMany is a single round-trip and atomic at the DB level. If one
  // doc fails validation, none are inserted (ordered: true is the default).
  const docs = parcels.map((p) => ({
    ...p,
    ...applyCalibrationOnCreate(p),
    ownerId,
  }));
  const created = await Parcel.insertMany(docs, { ordered: true });
  const createdArr = created as unknown as IParcel[];
  void maybeSendFirstParcelEmail(ownerId, createdArr);
  void maybePopulateSoil(createdArr);
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

  // 05-jun-2026: cooperative / adv / regantes pueden ver parcelas de sus
  // socios (farmers con cooperativeId apuntando al agregador). Antes
  // forbidden → frontend mostraba "Parcela no encontrada" al clickear
  // una parcela desde el dashboard agregado. Bug destapado en demo regantes.
  let isAggregatorOfOwner = false;
  if (
    options.userRole === 'cooperative' ||
    options.userRole === 'adv' ||
    options.userRole === 'regantes'
  ) {
    const owner = await User.findById(parcel.ownerId).select('cooperativeId').lean();
    if (owner?.cooperativeId?.toString() === userId) {
      isAggregatorOfOwner = true;
    }
  }

  if (!isOwner && !isAdminRead && !isInsurerCartera && !isAggregatorOfOwner) {
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

export async function getNdviHistory(
  parcelId: string,
  userId: string,
  options: { allowAdminRead?: boolean; userRole?: string } = {},
) {
  // Fail closed: misma lógica de propiedad/rol que el detalle de la parcela.
  // Antes el userId entraba pero NO se usaba → cualquier autenticado leía el
  // histórico NDVI de cualquier parcela.
  const parcel = await getParcelById(parcelId, userId, options);
  return parcel.ndviHistory;
}
