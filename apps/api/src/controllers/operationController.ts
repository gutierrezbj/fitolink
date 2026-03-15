import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as operationService from '../services/operationService.js';

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
