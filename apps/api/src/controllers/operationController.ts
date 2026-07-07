import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as operationService from '../services/operationService.js';
import { AppError } from '../utils/AppError.js';
import { generateApplicationPdf, type ApplicationReportInput } from '../services/reportService.js';

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
