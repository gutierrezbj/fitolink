import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as alertService from '../services/alertService.js';
import { sendAlertEmail } from '../services/emailService.js';
import { Alert } from '../models/Alert.js';
import { Parcel } from '../models/Parcel.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

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

/**
 * Resend an alert by email — debug / on-demand notification.
 * Useful for showing the email to a prospect during a demo without waiting
 * for the pipeline to fire a real alert.
 *
 * Accepts optional `to` in the body to override the parcel owner's email
 * (handy for piping the demo email to a prospect's address).
 */
export async function resendEmail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const alert = await Alert.findById(req.params.id).lean();
    if (!alert) throw AppError.notFound('Alerta');

    const parcel = await Parcel.findById(alert.parcelId).lean();
    if (!parcel) throw AppError.notFound('Parcela');

    const overrideTo = typeof req.body?.to === 'string' ? req.body.to.trim() : null;
    let toEmail: string;
    let recipientName: string;

    if (overrideTo) {
      toEmail = overrideTo;
      recipientName = typeof req.body?.name === 'string' ? req.body.name.trim() : 'agricultor';
    } else {
      const owner = await User.findById(parcel.ownerId).select('name email').lean();
      if (!owner?.email) throw AppError.badRequest('La parcela no tiene email de propietario; pasa `to` en el body');
      toEmail = owner.email;
      recipientName = owner.name ?? 'agricultor';
    }

    await sendAlertEmail({
      to: toEmail,
      recipientName,
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

    res.json({ success: true, data: { sentTo: toEmail, alertId: String(alert._id) } });
  } catch (error) {
    next(error);
  }
}
