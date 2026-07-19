import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { CROP_TYPES } from '@fitolink/shared';
import { User } from '../models/User.js';
import { Parcel } from '../models/Parcel.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/**
 * Sprint Bridge DJI → FitoLink · Fase 0 · import de parcelas bajo un cliente.
 *
 * El parseo del KMZ/KML del mando DJI Agras se hace en el frontend
 * (`lib/missionParser.ts` · togeojson + JSZip), igual que el importador de
 * autoservicio del agricultor. Lo que este endpoint añade es la capacidad
 * que faltaba: un operador AgroM importa las parcelas bajo la cuenta de OTRO
 * cliente (existente o creado al vuelo), no bajo la suya. Cierra el gap
 * "Mis Parcelas no distingue titular" para el flujo operador→cliente.
 *
 * Idempotente por (ownerId + name): re-importar el mismo archivo actualiza
 * geometría/cultivo en vez de duplicar.
 */

const polygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
});

const importSchema = z
  .object({
    // Cliente destino: existente (ownerId) O nuevo (newOwner). Uno de los dos.
    ownerId: z.string().length(24).optional(),
    newOwner: z
      .object({
        name: z.string().min(2).max(120),
        email: z.string().email(),
        phone: z.string().max(30).optional(),
      })
      .optional(),
    province: z.string().max(60).optional(),
    parcels: z
      .array(
        z.object({
          name: z.string().min(1).max(120),
          cropType: z.enum(CROP_TYPES),
          geometry: polygonGeometrySchema,
          areaHa: z.number().nonnegative(),
          applicationTarget: z.boolean().optional(),
          applicationCrop: z.string().max(40).optional(),
        }),
      )
      .min(1)
      .max(200),
  })
  .refine((d) => !!d.ownerId || !!d.newOwner, {
    message: 'Debe indicar ownerId (cliente existente) o newOwner (cliente nuevo)',
  });

// POST /admin/parcels/import  (JSON · geometrías ya parseadas en el cliente)
export async function importParcels(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.badRequest(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    }
    const { ownerId, newOwner, province, parcels } = parsed.data;

    // Resolver el cliente destino.
    let owner;
    if (ownerId) {
      owner = await User.findById(ownerId);
      if (!owner) throw AppError.notFound('Cliente (ownerId) no encontrado');
    } else if (newOwner) {
      const email = newOwner.email.trim().toLowerCase();
      owner = await User.findOne({ email });
      if (!owner) {
        owner = await User.create({
          email,
          name: newOwner.name.trim(),
          role: 'farmer',
          phone: newOwner.phone,
          googleId: `import-kmz-${email}`,
          isVerified: true,
          avatar: '/farmer.svg',
        });
        logger.info({ id: owner._id.toString(), email }, 'admin_import_created_owner');
      }
    }
    if (!owner) throw AppError.badRequest('No se pudo resolver el cliente destino');

    // Crear/actualizar parcelas · idempotente por (ownerId + name).
    const created: string[] = [];
    const updated: string[] = [];
    for (const p of parcels) {
      const existing = await Parcel.findOne({ name: p.name, ownerId: owner._id });
      const doc = {
        geometry: p.geometry,
        areaHa: p.areaHa,
        cropType: p.cropType,
        province: province ?? '',
        ...(p.applicationTarget
          ? { applicationTarget: true, applicationCrop: p.applicationCrop ?? p.cropType }
          : {}),
      };
      if (existing) {
        Object.assign(existing, doc);
        await existing.save();
        updated.push(existing._id.toString());
      } else {
        const parcel = await Parcel.create({
          ownerId: owner._id,
          name: p.name,
          isInsured: false,
          isActive: true,
          isSyntheticDemo: false,
          ndviHistory: [],
          ...doc,
        });
        created.push(parcel._id.toString());
      }
    }

    logger.info(
      { owner: owner._id.toString(), created: created.length, updated: updated.length },
      'admin_import_confirmed',
    );

    res.status(201).json({
      success: true,
      data: {
        ownerId: owner._id.toString(),
        ownerName: owner.name,
        ownerEmail: owner.email,
        created: created.length,
        updated: updated.length,
        parcelIds: [...created, ...updated],
      },
    });
  } catch (error) {
    next(error);
  }
}
