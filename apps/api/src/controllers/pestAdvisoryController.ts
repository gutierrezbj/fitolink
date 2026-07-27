import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as pestService from '../services/pestAdvisoryService.js';
import * as parcelService from '../services/parcelService.js';

/**
 * Público (SIN auth): tablón de avisos fitosanitarios para la página /avisos
 * (lead magnet — "FitoLink agrega los boletines oficiales de plagas de
 * España"). Devuelve los avisos activos vigentes con campos públicos; NO
 * expone internos (fingerprint, createdBy). 11-jun-2026.
 */
export async function publicList(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const advisories = await pestService.listAdvisories({ activeOnly: true });
    const data = advisories.map((a) => ({
      id: String(a._id),
      pestName: a.pestName,
      cropTypes: a.cropTypes,
      severity: a.severity,
      source: a.source,
      sourceRef: a.sourceRef,
      sourceUrl: a.sourceUrl,
      regions: (a.affectedAreas ?? []).map((z) => z.comarca ?? z.province).filter(Boolean),
      detectedAt: a.detectedAt,
      notes: a.notes,
      // ¿Encabeza el tablón por defecto? Lo grave siempre, y lo que la propia
      // fuente marca como relevante esta semana. La ingesta semanal del RAIF
      // trae ~150 avisos de rutina; sin este filtro el tablón público es un
      // muro. `notifyParcels` es false SOLO en los avisos de rutina del boletín
      // (los legacy/curados no tienen el campo → !== false → destacados).
      featured: a.severity === 'high' || a.notifyParcels !== false,
    }));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

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
 * User-scoped: advisories matching ANY of the caller's parcels, deduped
 * by advisory with the list of affected parcels. Feeds the comarca
 * section of AlertsPage (Sprint AlertsPage comarca · 11-jun-2026).
 */
export async function getMine(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const advisories = await pestService.getAdvisoriesForUser(req.user!._id.toString());
    res.json({ success: true, data: advisories });
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
