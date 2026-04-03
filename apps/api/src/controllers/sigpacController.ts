import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import * as sigpacService from '../services/sigpacService.js';

const REQUIRED_PARAMS = ['prov', 'muni', 'agre', 'zona', 'poligono', 'parcela', 'recinto'] as const;

function isNumericString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

export async function lookupSigpac(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    for (const param of REQUIRED_PARAMS) {
      const value = req.query[param];
      if (value === undefined || value === null || value === '') {
        throw AppError.badRequest(`Parámetro requerido: ${param}`);
      }
      if (!isNumericString(value)) {
        throw AppError.badRequest(`El parámetro ${param} debe ser numérico`);
      }
    }

    const prov = req.query.prov as string;
    const muni = req.query.muni as string;
    const agre = req.query.agre as string;
    const zona = req.query.zona as string;
    const poligono = req.query.poligono as string;
    const parcela = req.query.parcela as string;
    const recinto = req.query.recinto as string;

    const result = await sigpacService.fetchByReference(prov, muni, agre, zona, poligono, parcela, recinto);

    const sigpacRef = `${prov}-${muni}-${agre}-${zona}-${poligono}-${parcela}-${recinto}`;

    res.json({
      success: true,
      data: {
        geometry: result.geometry,
        areaHa: result.areaHa,
        cropUse: result.cropUse,
        sigpacRef,
      },
    });
  } catch (error) {
    next(error);
  }
}
