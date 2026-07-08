import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { User, type IUser } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { generateToken } from '../middleware/auth.js';
import { sendWelcomeEmail } from './emailService.js';
import type { UserRole } from '@fitolink/shared';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

// Roles que un usuario puede auto-darse de alta desde la web pública (los que
// ofrece RegisterPage.tsx). 'admin' y 'agronomist' quedan FUERA a propósito.
const SELF_SERVE_ROLES = new Set<UserRole>([
  'farmer',
  'cooperative',
  'pilot',
  'insurer',
  'adv',
  'regantes',
]);

interface GooglePayload {
  sub: string;
  email: string;
  emailVerified: boolean;
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
      // Google marca email_verified=false en algunas cuentas (Workspace,
      // federación SAML). Lo propagamos para no enlazar cuentas por un email
      // que Google no ha verificado (guía oficial de Google Identity).
      emailVerified: payload.email_verified === true,
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    throw AppError.unauthorized('Token de Google invalido');
  }
}

export async function loginWithGoogle(credential: string): Promise<{ token: string; user: IUser }> {
  const payload = await verifyGoogleToken(credential);

  let user = await User.findOne({ googleId: payload.sub });
  if (!user && payload.emailVerified) {
    // La cuenta pudo crearse antes con otro googleId (dev-login o alta
    // despistada). Solo enlazamos si Google confirma el email como VERIFICADO:
    // sin esa comprobación, un token con un email ajeno no verificado podría
    // apropiarse de una cuenta existente. Estampamos el googleId real → el
    // usuario existente entra sin quedar en el bucle "regístrate / ya existe".
    user = await User.findOne({ email: payload.email.toLowerCase() });
    if (user && user.googleId !== payload.sub) {
      user.googleId = payload.sub;
      // validateModifiedOnly: no revalidar el documento entero al solo
      // enlazar el googleId — un dato legacy incompleto dejaría al usuario
      // sin poder entrar ni registrarse (encierro).
      await user.save({ validateModifiedOnly: true });
    }
  }
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
  assertDevLoginAllowed(user);

  const token = generateToken(user._id.toString());
  return { token, user };
}

// Cuentas con datos REALES privados que NUNCA se sirven por dev-login, aunque
// por accidente llevaran prefijo 'demo-'. john-pistacho-real (cliente pistacho
// real, 348 ha Toledo) no lleva prefijo y ya quedaría fuera; se lista explícito
// por robustez. Sigue la misma convención que digestService (REAL_DATA_*).
const DEV_LOGIN_DENYLIST = new Set<string>(['john-pistacho-real']);

// Cuentas demo servibles que NO siguen el prefijo 'demo-' (excepciones).
const DEV_LOGIN_EXTRA_ALLOW = new Set<string>([
  'jesus-vivar-edu', // Aula Jaén Jesús (pedagógica sintética)
  'john-jawer-agrom', // John Jawer · piloto socio de AgroM (opera bajo Drovinci).
                      // Sin datos privados de terceros (solo la cartera demo PAC
                      // que ya es servible). Le da sesión de piloto para ver sus
                      // Asignaciones y completar operaciones con datos reales.
]);

function isServableDemoAccount(user: IUser): boolean {
  // Datos reales privados fuera SIEMPRE.
  if (DEV_LOGIN_DENYLIST.has(user.googleId)) return false;
  // Sintéticas/demo: prefijo 'demo-' (seeds como demo-pac-…, demo-cooperative-…,
  // socios, + auto-email 'demo-email-…') o excepción explícita. Los usuarios
  // REALES tienen googleId = sub NUMÉRICO de Google → nunca llevan 'demo-' →
  // no servibles por email (no hay takeover de cuentas reales). El rol admin lo
  // veta aparte assertDevLoginAllowed (aunque tenga prefijo demo-).
  return user.googleId.startsWith('demo-') || DEV_LOGIN_EXTRA_ALLOW.has(user.googleId);
}

/**
 * En producción el dev-login (chips + email) SOLO sirve cuentas demo del
 * allowlist. Bloquea: el rol admin (cualquiera se haría administrador con un
 * click, sin secreto), la cuenta real del cliente (john-pistacho-real) y
 * cualquier usuario real. En desarrollo local no aplica — se puede depurar
 * cualquier cuenta (NODE_ENV !== 'production').
 */
function assertDevLoginAllowed(user: IUser): void {
  if (env.NODE_ENV !== 'production') return;
  if (user.role === 'admin') {
    throw AppError.forbidden('La cuenta de administración entra con Google');
  }
  if (!isServableDemoAccount(user)) {
    throw AppError.forbidden('Esta cuenta no está disponible por acceso demo');
  }
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
  if (user) {
    // En prod, entrar por email a una cuenta EXISTENTE solo si es demo del
    // allowlist: bloquea la suplantación de cuentas reales (john-pistacho-real
    // u otros usuarios reales) tecleando su email. Las reales entran con Google.
    assertDevLoginAllowed(user);
  }
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

export interface RegisterOptions {
  acceptedTerms?: boolean;
  acceptedTermsAt?: string;
}

export async function registerWithGoogle(
  credential: string,
  role: UserRole,
  phone?: string,
  options: RegisterOptions = {},
): Promise<{ token: string; user: IUser }> {
  const payload = await verifyGoogleToken(credential);

  // Blindaje de escalada de privilegios: el alta pública SOLO permite roles
  // auto-servibles. Sin esto, cualquiera con una cuenta Google válida podía
  // hacer POST /auth/register {role:'admin'} y volverse administrador de toda
  // la app. 'admin' se crea por seed + Google; 'agronomist' es alta interna.
  if (!SELF_SERVE_ROLES.has(role)) {
    throw AppError.forbidden('Este rol no puede darse de alta públicamente');
  }

  const existing = await User.findOne({
    $or: [{ googleId: payload.sub }, { email: payload.email }],
  });
  if (existing) {
    throw AppError.conflict('Ya existe una cuenta con este email');
  }

  // Auto-verified roles: only farmer self-onboards. Cooperative / pilot /
  // insurer need manual review (commercial implications, certs, etc.).
  const isAutoVerified = role === 'farmer';

  const user = await User.create({
    email: payload.email,
    name: payload.name,
    avatar: payload.picture,
    googleId: payload.sub,
    role,
    phone,
    isVerified: isAutoVerified,
    // RGPD audit trail — stamp consent at alta. The User model carries
    // both fields; the policy version is the date the user accepted.
    acceptedTerms: options.acceptedTerms ?? false,
    acceptedTermsAt: options.acceptedTermsAt ? new Date(options.acceptedTermsAt) : undefined,
  });

  // Welcome email — fire-and-forget. Si falla SMTP el alta sigue válida;
  // sendWelcomeEmail nunca lanza. Para roles que requieren verificación
  // manual el mensaje cambia (heads-up de validación 24-48h).
  void sendWelcomeEmail({
    to: user.email,
    recipientName: user.name,
    role: user.role,
    needsVerification: !isAutoVerified,
  });

  const token = generateToken(user._id.toString());
  return { token, user };
}
