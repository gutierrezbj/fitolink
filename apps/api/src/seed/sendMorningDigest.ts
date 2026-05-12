/**
 * Morning digest runner — Ola 1.5 · Pieza 4.
 *
 * Two modes:
 *   - CLI manual: validate via `--dry-run` before flipping `DIGEST_CRON=true`.
 *   - Cron in-process: registered in `index.ts` when `DIGEST_CRON=true`.
 *
 * CLI flags
 * ---------
 *   --dry-run                Don't call SMTP, log what would be sent.
 *   --force                  Skip the same-day idempotency check.
 *   --user <email|googleId>  Run for ONE user (handy to test on
 *                            john-pistacho-real before going broad).
 *   --all                    Run for every eligible user (default if no
 *                            --user is given).
 *
 * Examples
 * --------
 *   # safe smoke test on Jonh's pistacho client (real data, no SMTP):
 *   docker compose exec -T api node apps/api/dist/seed/sendMorningDigest.js \
 *     --user john-pistacho-real --dry-run
 *
 *   # actually send to one user (idempotent — second run today is a no-op):
 *   docker compose exec -T api node apps/api/dist/seed/sendMorningDigest.js \
 *     --user gutierrezbj@gmail.com
 *
 *   # full daily run — what the cron does at 5:00 UTC:
 *   docker compose exec -T api node apps/api/dist/seed/sendMorningDigest.js --all
 */
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import {
  sendDigestForUser,
  listEligibleDigestUsers,
  type SendDigestResult,
} from '../services/digestService.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

interface CliArgs {
  user?: string;
  dryRun: boolean;
  force: boolean;
  all: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, force: false, all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--all') args.all = true;
    else if (a === '--user' && argv[i + 1]) {
      args.user = argv[++i];
    }
  }
  if (!args.user) args.all = true;
  return args;
}

function summarize(email: string, result: SendDigestResult): void {
  const d = result.digest;
  logger.info(
    {
      to: email,
      status: result.status,
      reason: result.reason,
      ndviActionable: d?.ndviSection.actionable.length,
      ndviStable: d?.ndviSection.stableCount,
      weatherEvents: d?.weatherSection.length,
      pestAdvisories: d?.pestSection.length,
      parcels: d?.parcelCount,
      hectares: d?.totalHectares,
    },
    `digest · ${result.status}`,
  );
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  await mongoose.connect(MONGODB_URI);
  logger.info({ args }, 'sendMorningDigest started');

  let stats = {
    eligible: 0,
    sent: 0,
    dryRun: 0,
    skippedNothing: 0,
    skippedAlready: 0,
    skippedIneligible: 0,
    errors: 0,
  };

  try {
    if (args.user) {
      // Resolve the single user by email OR googleId. Email is lowercased
      // by the schema, so try both forms.
      const u = await User.findOne({
        $or: [
          { email: args.user.toLowerCase().trim() },
          { googleId: args.user },
        ],
      });
      if (!u) {
        logger.error({ user: args.user }, 'sendMorningDigest: user not found');
        process.exit(1);
      }
      stats.eligible = 1;
      try {
        const result = await sendDigestForUser(u._id, {
          dryRun: args.dryRun,
          force: args.force,
        });
        bump(stats, result);
        summarize(u.email, result);
      } catch (err) {
        stats.errors += 1;
        logger.error({ err, to: u.email }, 'digest send threw');
      }
    } else {
      const users = await listEligibleDigestUsers();
      stats.eligible = users.length;
      logger.info({ count: users.length }, 'sendMorningDigest: eligible cohort');
      for (const u of users) {
        try {
          const result = await sendDigestForUser(u._id, {
            dryRun: args.dryRun,
            force: args.force,
          });
          bump(stats, result);
          summarize(u.email, result);
        } catch (err) {
          stats.errors += 1;
          logger.error({ err, to: u.email }, 'digest send threw');
        }
      }
    }
  } finally {
    logger.info({ stats }, 'sendMorningDigest finished');
    await mongoose.disconnect();
  }
}

function bump(stats: { sent: number; dryRun: number; skippedNothing: number; skippedAlready: number; skippedIneligible: number; }, r: SendDigestResult): void {
  switch (r.status) {
    case 'sent': stats.sent += 1; break;
    case 'dry-run': stats.dryRun += 1; break;
    case 'skipped:nothing-to-say': stats.skippedNothing += 1; break;
    case 'skipped:already-today': stats.skippedAlready += 1; break;
    case 'skipped:ineligible': stats.skippedIneligible += 1; break;
  }
}

run().catch((err) => {
  logger.error({ err }, 'sendMorningDigest crashed');
  process.exit(1);
});
