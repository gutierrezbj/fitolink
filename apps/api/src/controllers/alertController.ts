import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as alertService from '../services/alertService.js';

export async function getMyAlerts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const alerts = await alertService.getAlertsByUser(req.user!._id.toString());
    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
}

export async function getByParcel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const alerts = await alertService.getAlertsByParcel(req.params.parcelId as string);
    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
}

export async function getActive(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const { alerts, total } = await alertService.getActiveAlerts(page, limit);
    res.json({ success: true, data: alerts, meta: { total, page, limit } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const alert = await alertService.updateAlert(req.params.id as string, req.body);
    res.json({ success: true, data: alert });
  } catch (error) {
    next(error);
  }
}
