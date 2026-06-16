/**
 * Actualiza el email del cliente pistacho demo (john-pistacho-real) al
 * dominio profesional AgroM. Sustituye el Gmail personal de Jonh que
 * usábamos como inbox del digest matutino.
 *
 * Contexto · 13-may-2026
 * ----------------------
 * AgroM puso en marcha el dominio propio agrom.es (Hostinger). Jonh
 * tiene ahora una cuenta en ese dominio profesional. El digest matutino
 * del cliente pistacho (que llega a Jonh todos los días 7am desde commit
 * c895432) debe mover a esa cuenta profesional.
 *
 * Los emails (antiguo y nuevo) NO viven en el código: se inyectan por
 * variables de entorno `PISTACHAR_EMAIL_OLD` y `PISTACHAR_EMAIL`.
 * Antes:  `User.email` de `john-pistacho-real` = $PISTACHAR_EMAIL_OLD
 * Después: `User.email` de `john-pistacho-real` = $PISTACHAR_EMAIL
 *
 * Idempotente
 * -----------
 * Re-ejecutar: si el email ya está actualizado, reporta `noop` y exit 0.
 * No toca otros campos del User.
 *
 * Run via
 * -------
 *   docker compose exec -T api node apps/api/dist/seed/updatePistacharEmail.js
 *   docker compose exec -T api node apps/api/dist/seed/updatePistacharEmail.js --dry-run
 */
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';
const GOOGLE_ID = 'john-pistacho-real';
// PII fuera del código (el repo puede ser público). El valor real llega por
// variable de entorno; el fallback NO contiene PII real.
const NEW_EMAIL = process.env.PISTACHAR_EMAIL || '';
const OLD_EMAIL = process.env.PISTACHAR_EMAIL_OLD || '';

/** Enmascara un email para logs: jo***@dominio. Nunca lo loguea en claro. */
function maskEmail(email: string): string {
  if (!email) return '(sin definir)';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');

  if (!NEW_EMAIL) {
    logger.error('PISTACHAR_EMAIL no definido — define la variable de entorno antes de ejecutar');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  // Sin PII en claro: el email se enmascara en el log.
  logger.info({ dryRun, googleId: GOOGLE_ID, newEmail: maskEmail(NEW_EMAIL) }, 'updatePistacharEmail started');

  const user = await User.findOne({ googleId: GOOGLE_ID });
  if (!user) {
    logger.error('user not found — was the demo seed ever run?');
    await mongoose.disconnect();
    process.exit(1);
  }

  logger.info({ previousEmail: maskEmail(user.email) }, 'estado actual');

  if (user.email === NEW_EMAIL) {
    logger.info('noop — email ya estaba al día');
    await mongoose.disconnect();
    return;
  }

  if (dryRun) {
    logger.info({ wouldUpdate: { from: maskEmail(user.email), to: maskEmail(NEW_EMAIL) } }, 'dry-run · sin modificación');
    await mongoose.disconnect();
    return;
  }

  user.email = NEW_EMAIL;
  await user.save();
  // `from` viene de env (PISTACHAR_EMAIL_OLD) y se enmascara; nada de PII en claro.
  logger.info({ from: maskEmail(OLD_EMAIL || user.email), to: maskEmail(NEW_EMAIL) }, 'email actualizado');

  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error({ err }, 'updatePistacharEmail failed');
  process.exit(1);
});
