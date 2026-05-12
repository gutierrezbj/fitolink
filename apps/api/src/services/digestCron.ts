/**
 * In-process morning digest scheduler — Ola 1.5 · Pieza 4.
 *
 * Why setInterval instead of node-cron
 * ------------------------------------
 * One job, fires once per day, with idempotency already guaranteed by
 * `User.lastDigestSentAt`. A 60-second tick checking the wall clock is
 * sufficient and avoids adding a dependency. If we ever need multiple
 * jobs or finer schedule expressions, swap to node-cron in one place.
 *
 * Schedule
 * --------
 * Fires when the UTC clock crosses 05:00 — that's 07:00 Madrid in summer
 * (CEST, UTC+2) and 06:00 Madrid in winter (CET, UTC+1). For Tipo A
 * farmers the "early morning" feel matters more than the exact hour;
 * shipping at 06–07 local time satisfies both halves of the year without
 * timezone wrangling.
 *
 * Idempotency on top of idempotency
 * ---------------------------------
 * - This module guards against multiple ticks per day with `lastRunAt`.
 * - `sendDigestForUser` also checks `User.lastDigestSentAt`. Belt + suspenders
 *   so a process restart between 05:00 and 05:01 cannot double-send.
 */
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { listEligibleDigestUsers, sendDigestForUser } from './digestService.js';

let timer: NodeJS.Timeout | null = null;
let lastRunUtcDate: string | null = null; // e.g. "2026-05-12"
let runningNow = false;

const TARGET_UTC_HOUR = 5; // 05:00 UTC ≈ 07:00 Madrid in summer / 06:00 in winter

export function startDigestCron(): void {
  if (!env.DIGEST_CRON) {
    logger.info('Digest cron: DIGEST_CRON env not set, scheduler not started');
    return;
  }
  if (timer) {
    logger.warn('Digest cron: already started — ignoring second call');
    return;
  }
  logger.info({ targetUtcHour: TARGET_UTC_HOUR }, 'Digest cron: scheduler started');

  // Tick every 60s. Cheap; the work inside the tick is just a clock check
  // unless the window is reached.
  timer = setInterval(tick, 60_000);
  // Fire once immediately too: if the API restarts at 05:30 UTC we still
  // catch today's window. The lastDigestSentAt per-user check prevents
  // double-sends.
  void tick();
}

export function stopDigestCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function tick(): Promise<void> {
  if (runningNow) return;
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcDate = now.toISOString().slice(0, 10);

  // Only fire inside the target hour, and at most once per UTC date.
  if (utcHour !== TARGET_UTC_HOUR) return;
  if (lastRunUtcDate === utcDate) return;

  runningNow = true;
  lastRunUtcDate = utcDate; // mark before work so a slow tick doesn't double-trigger
  try {
    await runDigestForAllEligible();
  } catch (err) {
    logger.error({ err }, 'Digest cron: runDigestForAllEligible crashed');
  } finally {
    runningNow = false;
  }
}

async function runDigestForAllEligible(): Promise<void> {
  const t0 = Date.now();
  const users = await listEligibleDigestUsers();
  logger.info({ count: users.length }, 'Digest cron: fan-out start');

  const stats = { sent: 0, skippedNothing: 0, skippedAlready: 0, skippedIneligible: 0, errors: 0 };

  for (const u of users) {
    try {
      const r = await sendDigestForUser(u._id);
      switch (r.status) {
        case 'sent': stats.sent += 1; break;
        case 'skipped:nothing-to-say': stats.skippedNothing += 1; break;
        case 'skipped:already-today': stats.skippedAlready += 1; break;
        case 'skipped:ineligible': stats.skippedIneligible += 1; break;
      }
    } catch (err) {
      stats.errors += 1;
      logger.error({ err, to: u.email }, 'Digest cron: per-user send threw');
    }
  }

  logger.info({ stats, ms: Date.now() - t0 }, 'Digest cron: fan-out complete');
}
