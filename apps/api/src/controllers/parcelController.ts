import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as parcelService from '../services/parcelService.js';
import * as ndviSnapshotService from '../services/ndviSnapshotService.js';

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parcel = await parcelService.createParcel(req.user!._id.toString(), req.body);
    res.status(201).json({ success: true, data: parcel });
  } catch (error) {
    next(error);
  }
}

export async function getMyParcels(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parcels = await parcelService.getParcelsByOwner(req.user!._id.toString());
    res.json({ success: true, data: parcels });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parcel = await parcelService.getParcelById(req.params.id as string, req.user!._id.toString());
    res.json({ success: true, data: parcel });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parcel = await parcelService.updateParcel(req.params.id as string, req.user!._id.toString(), req.body);
    res.json({ success: true, data: parcel });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await parcelService.deleteParcel(req.params.id as string, req.user!._id.toString());
    res.json({ success: true, data: { message: 'Parcela eliminada' } });
  } catch (error) {
    next(error);
  }
}

export async function getNdviHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await parcelService.getNdviHistory(req.params.id as string, req.user!._id.toString());
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
}

export async function getNdviSnapshot(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const snapshot = await ndviSnapshotService.getLatestSnapshot(
      req.params.id as string,
      req.user!._id.toString(),
      req.user!.role,
    );
    res.json({ success: true, data: snapshot ?? null });
  } catch (error) {
    next(error);
  }
}

export async function getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const { parcels, total } = await parcelService.getAllParcels(page, limit);
    res.json({ success: true, data: parcels, meta: { total, page, limit } });
  } catch (error) {
    next(error);
  }
}
