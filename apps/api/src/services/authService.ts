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
  if (env.NODE_ENV === 'production') {
    throw AppError.forbidden('Dev login no disponible en produccion');
  }

  const user = await User.findOne({ googleId });
  if (!user) {
    throw AppError.notFound('Usuario demo no encontrado');
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
