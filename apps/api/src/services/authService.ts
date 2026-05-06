import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { User, type IUser } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { generateToken } from '../middleware/auth.js';
import type { UserRole } from '@fitolink/shared';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

interface GooglePayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

async function verifyGoogleToken(credential: string): Promise<GooglePayload> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.name) {
      throw new Error('Invalid payload');
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    throw AppError.unauthorized('Token de Google invalido');
  }
}

export async function loginWithGoogle(credential: string): Promise<{ token: string; user: IUser }> {
  const payload = await verifyGoogleToken(credential);

  const user = await User.findOne({ googleId: payload.sub });
  if (!user) {
    throw AppError.notFound('Usuario no registrado. Por favor, registrate primero.');
  }

  const token = generateToken(user._id.toString());
  return { token, user };
}

export async function devLogin(googleId: string): Promise<{ token: string; user: IUser }> {
  const allowDevLogin = env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOGIN === 'true';
  if (!allowDevLogin) {
    throw AppError.forbidden('Dev login no disponible en produccion');
  }

  const user = await User.findOne({ googleId });
  if (!user) {
    throw AppError.notFound('Usuario demo no encontrado');
  }

  const token = generateToken(user._id.toString());
  return { token, user };
}

/**
 * Email-based dev login. Finds an existing user by email or creates a new
 * farmer-role demo user on the fly. Used by the demo entry form on the
 * login page so prospects can self-onboard with their own email without
 * waiting for a Google OAuth setup.
 *
 * IMPORTANT: this MUST stay gated behind the same dev-login flag as
 * `devLogin()`. In real production it should be replaced by passwordless
 * email auth with one-time codes.
 */
export async function devLoginByEmail(
  email: string,
  name?: string,
): Promise<{ token: string; user: IUser }> {
  const allowDevLogin = env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOGIN === 'true';
  if (!allowDevLogin) {
    throw AppError.forbidden('Dev login no disponible en produccion');
  }

  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw AppError.badRequest('Email no valido');
  }

  let user = await User.findOne({ email: normalized });
  if (!user) {
    // Auto-provision a farmer demo user. googleId is synthesized from email
    // to satisfy the unique-required field on User without colliding with
    // real Google OAuth subjects (which are numeric ids).
    const derivedName = name?.trim() || normalized.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    user = await User.create({
      email: normalized,
      name: derivedName,
      role: 'farmer',
      googleId: `demo-email-${normalized}`,
      isVerified: true,
      avatar: '/farmer.svg',
    });
  }

  const token = generateToken(user._id.toString());
  return { token, user };
}

export async function registerWithGoogle(
  credential: string,
  role: UserRole,
  phone?: string,
): Promise<{ token: string; user: IUser }> {
  const payload = await verifyGoogleToken(credential);

  const existing = await User.findOne({
    $or: [{ googleId: payload.sub }, { email: payload.email }],
  });
  if (existing) {
    throw AppError.conflict('Ya existe una cuenta con este email');
  }

  const user = await User.create({
    email: payload.email,
    name: payload.name,
    avatar: payload.picture,
    googleId: payload.sub,
    role,
    phone,
    isVerified: role === 'farmer',
  });

  const token = generateToken(user._id.toString());
  return { token, user };
}
