import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as cooperativeService from '../services/cooperativeService.js';

/**
 * Cooperative dashboard endpoints. The single overview call drives the
 * whole landing page — KPIs, member list, parcel geometry — to keep the
 * UI snappy with one round-trip.
 */

export async function overview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await cooperativeService.getOverview(req.user!._id.toString());
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
