import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as pestService from '../services/pestAdvisoryService.js';
import * as parcelService from '../services/parcelService.js';

/**
 * Admin: create a new advisory (curated from RAIF / MAPA / SAIF bulletin).
 */
export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const advisory = await pestService.createAdvisory(req.body, req.user!._id.toString());
    res.status(201).json({ success: true, data: advisory });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: list advisories. `?all=1` includes inactive/expired ones.
 */
export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const advisories = await pestService.listAdvisories({
      activeOnly: req.query.all !== '1',
    });
    res.json({ success: true, data: advisories });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: deactivate an advisory (e.g. once the bulletin closes the case).
 */
export async function deactivate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const advisory = await pestService.deactivateAdvisory(req.params.id as string);
    res.json({ success: true, data: advisory });
  } catch (error) {
    next(error);
  }
}

/**
 * Parcel-scoped: advisories that match this parcel's crop + radius.
 * Same auth pattern as the other parcel insight endpoints.
 */
export async function getForParcel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await parcelService.getParcelById(
      req.params.id as string,
      req.user!._id.toString(),
      { allowAdminRead: true, userRole: req.user!.role },
    );
    const advisories = await pestService.getAdvisoriesForParcel(req.params.id as string);
    res.json({ success: true, data: advisories });
  } catch (error) {
    next(error);
  }
}
