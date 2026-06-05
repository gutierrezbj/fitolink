import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as cooperativeService from '../services/cooperativeService.js';
import { generateCarteraPdf, generateCarteraCsv } from '../services/reportService.js';

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

/**
 * Bloque B · Reportes · 05-jun-2026.
 *
 * Genera PDF o CSV de cartera agregada para que el gerente (cooperativa
 * / ADV / regantes) pueda llevar la información a junta directiva,
 * administración (RAIF/CHS) o socios.
 *
 * Query param `format=pdf|csv`. Mismo auth pattern que el overview · solo
 * el gerente que ya puede ver el overview puede descargar el reporte.
 */
export async function downloadReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const format = (req.query.format as string) ?? 'pdf';
    if (format !== 'pdf' && format !== 'csv') {
      res.status(400).json({ success: false, error: { message: 'format debe ser pdf o csv' } });
      return;
    }

    const overview = await cooperativeService.getOverview(req.user!._id.toString());
    const reportInput = {
      entityName: overview.cooperative.name,
      entityRole: req.user!.role as 'cooperative' | 'adv' | 'regantes',
      generatedAt: new Date(),
      kpis: overview.kpis,
      members: overview.members,
    };

    // Nombre archivo · usar fecha ISO + role para que el usuario distinga
    // descargas múltiples sin colisión.
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = overview.cooperative.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .toLowerCase();
    const filename = `cartera-${safeName}-${dateStr}.${format}`;

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const stream = generateCarteraPdf(reportInput);
      stream.pipe(res);
    } else {
      const csv = generateCarteraCsv(reportInput);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    }
  } catch (error) {
    next(error);
  }
}
