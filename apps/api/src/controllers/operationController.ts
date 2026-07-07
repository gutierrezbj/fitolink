import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as operationService from '../services/operationService.js';
import { AppError } from '../utils/AppError.js';
import {
  generateApplicationPdf,
  generateJobReportPdf,
  type ApplicationReportInput,
  type JobReportInput,
} from '../services/reportService.js';

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const operation = await operationService.createOperation(req.user!._id.toString(), req.body);
    res.status(201).json({ success: true, data: operation });
  } catch (error) {
    next(error);
  }
}

export async function getMyOperations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const operations = await operationService.getOperationsByFarmer(req.user!._id.toString());
    res.json({ success: true, data: operations });
  } catch (error) {
    next(error);
  }
}

export async function getAssignments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const operations = await operationService.getOperationsByPilot(req.user!._id.toString());
    res.json({ success: true, data: operations });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const operation = await operationService.getOperationById(req.params.id as string, req.user!._id.toString());
    res.json({ success: true, data: operation });
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const operation = await operationService.updateOperationStatus(
      req.params.id as string,
      req.user!._id.toString(),
      req.body.status,
    );
    res.json({ success: true, data: operation });
  } catch (error) {
    next(error);
  }
}

export async function complete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const operation = await operationService.completeOperation(
      req.params.id as string,
      req.user!._id.toString(),
      req.body,
    );
    res.json({ success: true, data: operation });
  } catch (error) {
    next(error);
  }
}

// Informe de aplicación en PDF de una operación completada.
export async function downloadReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const isAdmin = req.user!.role === 'admin';
    const op = await operationService.getOperationForReport(
      req.params.id as string,
      req.user!._id.toString(),
      isAdmin,
    );
    if (op.status !== 'completed') {
      throw AppError.badRequest('La operación aún no se ha completado; el informe estará disponible al finalizarla.');
    }

    // Preferimos la mezcla `products`; si solo hay el producto legacy, lo
    // adaptamos a la forma con unidad (L/ha) para no perder el dato.
    const products =
      op.products && op.products.length > 0
        ? op.products
        : op.product
          ? [{ name: op.product.name, dose: op.product.doseLPerHa, unit: 'L/ha', note: op.product.activeSubstance }]
          : [];

    const input: ApplicationReportInput = {
      generatedAt: new Date(),
      clientName: op.farmerId?.name ?? 'Cliente',
      operator: { company: op.pilotId?.company, pilotName: op.pilotId?.name },
      parcel: {
        name: op.parcelId?.name ?? 'Parcela',
        cropType: op.parcelId?.cropType ?? '',
        province: op.parcelId?.province,
        sigpacRef: op.parcelId?.sigpacRef,
        areaHa: op.parcelId?.areaHa,
      },
      completedAt: op.completedAt,
      flightLog: op.flightLog,
      products,
      applicationMethod: op.applicationMethod,
      weather: op.weatherConditions ?? null,
      prescription: op.prescription ?? null,
    };

    const slug = (op.parcelId?.name ?? 'parcela').normalize('NFD').replace(/[^0-9A-Za-z]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'parcela';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="informe-aplicacion-${slug}.pdf"`);
    generateApplicationPdf(input).pipe(res);
  } catch (error) {
    next(error);
  }
}

// Informe de TRABAJO: un PDF agregando varias operaciones completadas.
export async function downloadJobReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const ids = String(req.query.ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) throw AppError.badRequest('Indica las operaciones del trabajo (ids).');

    const isAdmin = req.user!.role === 'admin';
    const all = await operationService.getOperationsForJobReport(ids, req.user!._id.toString(), isAdmin);
    const ops = all.filter((o) => o.status === 'completed');
    if (ops.length === 0) throw AppError.badRequest('Ninguna de las operaciones seleccionadas está completada.');

    const parcels = ops.map((o) => ({
      name: o.parcelId?.name ?? 'Parcela',
      sigpacRef: o.parcelId?.sigpacRef,
      areaHa: o.flightLog?.areaHa ?? o.parcelId?.areaHa ?? 0,
      date: o.completedAt,
    }));
    const totalAreaHa = parcels.reduce((s, p) => s + p.areaHa, 0);

    // Agregación de productos: total = Σ (dosis × área) de los recintos que lo
    // usaron; dosis/ha si es la misma en todos.
    const prodMap = new Map<string, { name: string; unit: string; doses: Set<number>; total: number }>();
    for (const o of ops) {
      const area = o.flightLog?.areaHa ?? o.parcelId?.areaHa ?? 0;
      const list =
        o.products && o.products.length > 0
          ? o.products
          : o.product
            ? [{ name: o.product.name, dose: o.product.doseLPerHa, unit: 'L/ha' }]
            : [];
      for (const p of list) {
        const key = `${p.name}|${p.unit}`;
        const e = prodMap.get(key) ?? { name: p.name, unit: p.unit, doses: new Set<number>(), total: 0 };
        e.doses.add(p.dose);
        e.total += p.dose * area;
        prodMap.set(key, e);
      }
    }
    const products = [...prodMap.values()].map((e) => ({
      name: e.name,
      unit: e.unit,
      dosePerHa: e.doses.size === 1 ? [...e.doses][0] : undefined,
      total: e.total,
    }));

    const cropCounts = new Map<string, number>();
    for (const o of ops) {
      const c = o.parcelId?.cropType;
      if (c) cropCounts.set(c, (cropCounts.get(c) ?? 0) + 1);
    }
    const cropType = [...cropCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    const times = ops.map((o) => o.completedAt).filter(Boolean).map((d) => new Date(d as Date).getTime());
    const dateFrom = times.length ? new Date(Math.min(...times)) : undefined;
    const dateTo = times.length ? new Date(Math.max(...times)) : undefined;

    const input: JobReportInput = {
      generatedAt: new Date(),
      clientName: ops[0].farmerId?.name ?? 'Cliente',
      operator: { company: ops[0].pilotId?.company, pilotName: ops[0].pilotId?.name },
      cropType,
      dateFrom,
      dateTo,
      parcels,
      totalAreaHa,
      products,
      applicationMethod: ops.find((o) => o.applicationMethod)?.applicationMethod,
    };

    const slug = (cropType ?? 'trabajo').replace(/[^0-9A-Za-z]+/g, '-') || 'trabajo';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="informe-trabajo-${slug}.pdf"`);
    generateJobReportPdf(input).pipe(res);
  } catch (error) {
    next(error);
  }
}
