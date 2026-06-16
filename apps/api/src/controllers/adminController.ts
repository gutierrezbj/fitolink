import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import {
  getKpis,
  getAlertTimeline,
  listUsers,
  listOperations,
  listVerifiedPilots,
  assignPilot,
  updateOperationStatus,
} from '../services/adminService.js';

/**
 * Controladores del panel admin.
 *
 * Toda la lógica de negocio vive en adminService. Aquí solo el contrato
 * HTTP: cada handler envuelve su llamada en try/catch y delega los errores
 * a next(error) para que el middleware central responda (evita que un
 * rechazo async no capturado tumbe el proceso Node).
 */

// GET /admin/kpis — platform-wide KPI snapshot for the admin dashboard.
// Single round-trip; aggregations live server-side so the UI stays fast.
export async function getKpisHandler(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const kpis = await getKpis();
    res.json({ success: true, data: kpis });
  } catch (error) {
    next(error);
  }
}

// GET /admin/alerts/timeline?weeks=8 — alerts aggregated by week + severity,
// distribution by type, and top-5 worst parcels. Powers the OverWatch-style
// analytics charts in admin and insurer dashboards.
export async function getAlertTimelineHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const weeksRaw = typeof req.query.weeks === 'string' ? parseInt(req.query.weeks, 10) : NaN;
    const weeks = Math.max(4, Math.min(52, Number.isFinite(weeksRaw) ? weeksRaw : 8));
    const data = await getAlertTimeline(weeks);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// GET /admin/users — list users with the minimal PII the dashboard renders.
export async function getUsersHandler(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await listUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

// GET /admin/operations — all operations with full context for dispatcher.
export async function getOperationsHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const operations = await listOperations(req.query.status);
    res.json({ success: true, data: operations });
  } catch (error) {
    next(error);
  }
}

// GET /admin/pilots — verified pilots for manual assignment.
export async function getPilotsHandler(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const pilots = await listVerifiedPilots();
    res.json({ success: true, data: pilots });
  } catch (error) {
    next(error);
  }
}

// PATCH /admin/operations/:id/assign — manually assign pilot.
// pilotId se valida (ObjectId + existencia con rol 'pilot') en el servicio.
export async function assignPilotHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const op = await assignPilot(req.params.id as string, (req.body as { pilotId?: unknown }).pilotId);
    res.json({ success: true, data: op });
  } catch (error) {
    next(error);
  }
}

// PATCH /admin/operations/:id/status — admin override of operation status.
// status se valida contra el enum OPERATION_STATUSES en el servicio.
export async function updateStatusHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const op = await updateOperationStatus(req.params.id as string, (req.body as { status?: unknown }).status);
    res.json({ success: true, data: op });
  } catch (error) {
    next(error);
  }
}
