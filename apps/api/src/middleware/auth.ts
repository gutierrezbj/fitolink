import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, type IUser } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import type { UserRole } from '@fitolink/shared';

export interface AuthRequest extends Request {
  user?: IUser;
}

export function protect() {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw AppError.unauthorized('Token no proporcionado');
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };

      const user = await User.findById(decoded.userId);
      if (!user) {
        throw AppError.unauthorized('Usuario no encontrado');
      }

      req.user = user;
      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        next(AppError.unauthorized('Token invalido'));
      }
    }
  };
}

export function authorize(...roles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role as UserRole)) {
      next(AppError.forbidden('No tienes permisos para esta accion'));
      return;
    }
    next();
  };
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}
