import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService.js';
import type { AuthRequest } from '../middleware/auth.js';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { credential } = req.body;
    const result = await authService.loginWithGoogle(credential);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { credential, role, phone } = req.body;
    const result = await authService.registerWithGoogle(credential, role, phone);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  res.json({ success: true, data: req.user });
}

export async function devLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { googleId } = req.body;
    const result = await authService.devLogin(googleId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
