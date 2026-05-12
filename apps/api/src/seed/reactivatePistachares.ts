/**
 * Reactivate the 6 pistacho parcels owned by `john-pistacho-real`.
 *
 * Context: on 10-may we isolated these parcels (isActive=false +
 * establishmentPhase=true) because their low NDVI values were known
 * residual-poppy + newly-planted state, not disease, and were
 * contaminating the public demos with false positives.
 *
 * Now (12-may) Jonh is talking commercially with the client. We want
 * the client to be able to log in with a dedicated demo button and see
 * his own parcels with the new Ola 1.5 insights running on them. The
 * isolation flag `establishmentPhase` stays true — a future detector
 * V3 will use it to skip false-positive alerting on plantings in
 * establishment phase.
 *
 * Idempotent: if the parcels are already active the script reports 0
 * modified and exits 0.
 *
 * Run via:
 *   docker compose exec -T api node apps/api/dist/seed/reactivatePistachares.js
 */
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Parcel } from '../models/Parcel.js';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

async function run() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for pistacho reactivation');

  const owner = await User.findOne({ googleId: 'john-pistacho-real' });
  if (!owner) {
    logger.error('user john-pistacho-real not found — was the isolation seed ever run?');
    await mongoose.disconnect();
    process.exit(1);
  }

  const before = await Parcel.countDocuments({ ownerId: owner._id, isActive: false });
  const result = await Parcel.updateMany(
    { ownerId: owner._id, establishmentPhase: true },
    { $set: { isActive: true } },
  );
  const after = await Parcel.countDocuments({ ownerId: owner._id, isActive: true });

  logger.info(
    { wasInactive: before, modified: result.modifiedCount, nowActive: after },
    'Pistacho reactivation complete — establishmentPhase flag preserved',
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  logger.error({ err }, 'Pistacho reactivation failed');
  process.exit(1);
});
