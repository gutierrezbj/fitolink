import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as providerService from '../services/providerService.js';

export async function list(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const providers = await providerService.listProviders();
    res.json({ success: true, data: providers });
  } catch (error) {
    next(error);
  }
}

export async function createLead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const lead = await providerService.createLead(req.user!._id.toString(), req.body);
    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
}
