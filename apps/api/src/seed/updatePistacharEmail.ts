/**
 * Actualiza el email del cliente pistacho demo (john-pistacho-real) al
 * dominio profesional AgroM. Sustituye el Gmail personal de Jonh que
 * usábamos como inbox del digest matutino.
 *
 * Contexto · 13-may-2026
 * ----------------------
 * AgroM puso en marcha el dominio propio agrom.es (Hostinger). Jonh
 * tiene ahora `johnj@agrom.es`. El digest matutino del cliente pistacho
 * (que llega a Jonh todos los días 7am desde commit c895432) debe
 * mover a esa cuenta profesional.
 *
 * Antes: `User.email` de `john-pistacho-real` = `jawerjohn1993@gmail.com`
 * Después: `User.email` de `john-pistacho-real` = `johnj@agrom.es`
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
const NEW_EMAIL = 'johnj@agrom.es';

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(MONGODB_URI);
  logger.info({ dryRun, googleId: GOOGLE_ID, newEmail: NEW_EMAIL }, 'updatePistacharEmail started');

  const user = await User.findOne({ googleId: GOOGLE_ID });
  if (!user) {
    logger.error('user not found — was the demo seed ever run?');
    await mongoose.disconnect();
    process.exit(1);
  }

  logger.info({ previousEmail: user.email }, 'estado actual');

  if (user.email === NEW_EMAIL) {
    logger.info('noop — email ya estaba al día');
    await mongoose.disconnect();
    return;
  }

  if (dryRun) {
    logger.info({ wouldUpdate: { from: user.email, to: NEW_EMAIL } }, 'dry-run · sin modificación');
    await mongoose.disconnect();
    return;
  }

  user.email = NEW_EMAIL;
  await user.save();
  logger.info({ from: 'jawerjohn1993@gmail.com', to: NEW_EMAIL }, 'email actualizado');

  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error({ err }, 'updatePistacharEmail failed');
  process.exit(1);
});
