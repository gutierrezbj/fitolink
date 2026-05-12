/**
 * Morning digest orchestrator — Ola 1.5 · Pieza 4.
 *
 * Composes a daily 7-am AgroM email by merging the three predictive
 * insight services:
 *   - Pieza 1: NDVI forecasts (predictiveInsightService)
 *   - Pieza 2: Weather events 7 días (weatherEventsService)
 *   - Pieza 3: Pest advisories de la comarca (pestAdvisoryService)
 *
 * Public surface
 * --------------
 *   composeDigestForUser(userId)
 *     Returns a structured payload describing what should appear in the
 *     user's digest. The `worthSending` flag tells the cron whether the
 *     content is meaningful enough to spam the inbox.
 *
 *   sendDigestForUser(userId, options)
 *     Composes + sends via emailService.sendDigestEmail. Idempotent:
 *     refuses to fire if `lastDigestSentAt` is already today (UTC) and
 *     `force` is not set. Stamps `lastDigestSentAt` after a successful
 *     real send (dry-run does not stamp).
 *
 * Design choices
 * --------------
 * - "Worth sending" rule: at least ONE of the three sections must contain
 *   information the user can act on. Sending an empty digest 365 days a
 *   year is the fastest path to unsubscribe; the user only gets a digest
 *   when there's a reason to read it.
 * - Targeting V1: roles farmer + cooperative. Pilots, insurers and admin
 *   have other workflows. Demo accounts (googleId starting with `demo-`)
 *   are excluded unless explicitly named — `john-pistacho-real` is a
 *   real-data demo and IS included.
 * - Per-parcel weather is deduped at the user level: if 6 parcelas
 *   comparten provincia/comarca, sólo se emiten los eventos únicos por
 *   (type, date). El usuario no necesita "tormenta el viernes" 6 veces.
 */
import { Types } from 'mongoose';
import { User, type IUser } from '../models/User.js';
import { Parcel } from '../models/Parcel.js';
import { logger } from '../utils/logger.js';
import {
  getNdviForecastsForOwner,
  type NdviForecast,
} from './predictiveInsightService.js';
import {
  getWeatherEventsForParcel,
  type WeatherEvent,
} from './weatherEventsService.js';
import {
  getAdvisoriesForParcel,
  type ParcelPestAdvisory,
} from './pestAdvisoryService.js';
import { sendDigestEmail } from './emailService.js';

// ── Demo account allow/deny lists ───────────────────────────────────────

/**
 * Demo accounts that DO receive the digest because they hold real client
 * data and we want Jonh to be able to show the inbox flow.
 */
const REAL_DATA_DEMO_GOOGLE_IDS = new Set<string>(['john-pistacho-real']);

function isEligibleDemo(googleId: string): boolean {
  if (REAL_DATA_DEMO_GOOGLE_IDS.has(googleId)) return true;
  return !googleId.startsWith('demo-');
}

// ── Types ───────────────────────────────────────────────────────────────

export interface DigestParcelForecast {
  parcelId: string;
  parcelName: string;
  trend: NdviForecast['trend'];
  currentNdvi: number | null;
  daysToCritical: number | null;
  projectedCriticalDate: string | null;
  alreadyCritical: boolean;
  message: string;
}

export interface DigestWeatherEvent {
  type: WeatherEvent['type'];
  severity: WeatherEvent['severity'];
  date: string;
  dayLabel: string;
  message: string;
  /** Names of parcels the event applies to (used to mention "todas sus parcelas" vs "Parcela X"). */
  parcelNames: string[];
}

export interface DigestPestAdvisory {
  advisoryId: string;
  pestName: string;
  severity: ParcelPestAdvisory['severity'];
  province: string;
  comarca?: string;
  message: string;
  /** Names of parcels touched by the advisory. */
  parcelNames: string[];
}

export interface DigestPayload {
  user: {
    id: string;
    name: string;
    email: string;
    role: IUser['role'];
  };
  generatedAt: string;
  parcelCount: number;
  totalHectares: number;
  /** Forecasts grouped: only the actionable ones (descending or already critical) are surfaced. */
  ndviSection: {
    actionable: DigestParcelForecast[];
    stableCount: number;
  };
  /** Weather events deduped at the user level, sorted by date+severity. */
  weatherSection: DigestWeatherEvent[];
  /** Pest advisories applying to any of the user's parcels. */
  pestSection: DigestPestAdvisory[];
  /** True if at least one section has content worth reading. */
  worthSending: boolean;
}

// ── Composition ─────────────────────────────────────────────────────────

export async function composeDigestForUser(userId: string | Types.ObjectId): Promise<DigestPayload | null> {
  const user = await User.findById(userId).lean();
  if (!user) {
    logger.warn({ userId }, 'composeDigestForUser: user not found');
    return null;
  }

  // Eligibility filters happen here so callers don't have to repeat them.
  if (user.role !== 'farmer' && user.role !== 'cooperative') return null;
  if (user.digestSubscribed === false) return null;
  if (!isEligibleDemo(user.googleId)) return null;

  // ── Parcels (active only) ──
  const parcels = await Parcel.find({ ownerId: user._id, isActive: true })
    .select('_id name areaHa cropType geometry')
    .lean();

  if (parcels.length === 0) {
    return {
      user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
      generatedAt: new Date().toISOString(),
      parcelCount: 0,
      totalHectares: 0,
      ndviSection: { actionable: [], stableCount: 0 },
      weatherSection: [],
      pestSection: [],
      worthSending: false,
    };
  }

  const totalHa = parcels.reduce((s, p) => s + (p.areaHa ?? 0), 0);

  // ── Pieza 1: NDVI forecasts ──
  const forecasts = await getNdviForecastsForOwner(user._id.toString());
  const actionable: DigestParcelForecast[] = [];
  let stableCount = 0;
  for (const f of forecasts) {
    if (f.alreadyCritical || (f.trend === 'descending' && f.daysToCritical !== null)) {
      actionable.push({
        parcelId: f.parcelId,
        parcelName: f.parcelName,
        trend: f.trend,
        currentNdvi: f.currentNdvi,
        daysToCritical: f.daysToCritical,
        projectedCriticalDate: f.projectedCriticalDate,
        alreadyCritical: f.alreadyCritical,
        message: f.message ?? '',
      });
    } else {
      stableCount += 1;
    }
  }

  // ── Pieza 2: Weather events (parallel fetch, then dedupe by user) ──
  const weatherResults = await Promise.all(
    parcels.map(async (p) => {
      try {
        const r = await getWeatherEventsForParcel(p._id.toString());
        return { parcelName: p.name, events: r.events };
      } catch (err) {
        logger.warn({ err, parcelId: p._id.toString() }, 'digest: weather fetch failed for parcel');
        return { parcelName: p.name, events: [] };
      }
    }),
  );
  const weatherSection = dedupeWeather(weatherResults);

  // ── Pieza 3: Pest advisories (parallel fetch, then dedupe by user) ──
  const pestResults = await Promise.all(
    parcels.map(async (p) => {
      try {
        const r = await getAdvisoriesForParcel(p._id.toString());
        return { parcelName: p.name, advisories: r };
      } catch (err) {
        logger.warn({ err, parcelId: p._id.toString() }, 'digest: pest fetch failed for parcel');
        return { parcelName: p.name, advisories: [] };
      }
    }),
  );
  const pestSection = dedupePestAdvisories(pestResults);

  // ── Worth-sending rule ──
  // At least one section must have actionable content. Stable parcels +
  // empty weather + empty pest = no email today.
  const worthSending =
    actionable.length > 0 || weatherSection.length > 0 || pestSection.length > 0;

  return {
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
    generatedAt: new Date().toISOString(),
    parcelCount: parcels.length,
    totalHectares: Math.round(totalHa * 10) / 10,
    ndviSection: { actionable, stableCount },
    weatherSection,
    pestSection,
    worthSending,
  };
}

// ── Send (idempotent) ───────────────────────────────────────────────────

export interface SendDigestOptions {
  /** Skip the lastDigestSentAt same-day check. */
  force?: boolean;
  /** Do not call SMTP; just log what would be sent. */
  dryRun?: boolean;
}

export interface SendDigestResult {
  status: 'sent' | 'skipped:nothing-to-say' | 'skipped:already-today' | 'skipped:ineligible' | 'dry-run';
  reason?: string;
  digest?: DigestPayload;
}

export async function sendDigestForUser(
  userId: string | Types.ObjectId,
  options: SendDigestOptions = {},
): Promise<SendDigestResult> {
  const user = await User.findById(userId);
  if (!user) return { status: 'skipped:ineligible', reason: 'user-not-found' };

  if (user.role !== 'farmer' && user.role !== 'cooperative') {
    return { status: 'skipped:ineligible', reason: `role=${user.role}` };
  }
  if (user.digestSubscribed === false) {
    return { status: 'skipped:ineligible', reason: 'opted-out' };
  }
  if (!isEligibleDemo(user.googleId)) {
    return { status: 'skipped:ineligible', reason: 'demo-account' };
  }

  // Idempotency: did we already send today (UTC midnight comparison)?
  if (!options.force && user.lastDigestSentAt) {
    const last = new Date(user.lastDigestSentAt);
    const today = new Date();
    if (
      last.getUTCFullYear() === today.getUTCFullYear() &&
      last.getUTCMonth() === today.getUTCMonth() &&
      last.getUTCDate() === today.getUTCDate()
    ) {
      return { status: 'skipped:already-today', reason: last.toISOString() };
    }
  }

  const digest = await composeDigestForUser(user._id);
  if (!digest) return { status: 'skipped:ineligible', reason: 'compose-returned-null' };
  if (!digest.worthSending) {
    return { status: 'skipped:nothing-to-say', digest };
  }

  if (options.dryRun) {
    return { status: 'dry-run', digest };
  }

  await sendDigestEmail({ digest });

  user.lastDigestSentAt = new Date();
  await user.save();

  return { status: 'sent', digest };
}

// ── Helpers — dedupe ────────────────────────────────────────────────────

function dedupeWeather(
  results: Array<{ parcelName: string; events: WeatherEvent[] }>,
): DigestWeatherEvent[] {
  // Group events by (type, date). Aggregate parcel names per group.
  const map = new Map<string, DigestWeatherEvent>();
  for (const r of results) {
    for (const ev of r.events) {
      const key = `${ev.type}|${ev.date}`;
      const existing = map.get(key);
      if (existing) {
        if (!existing.parcelNames.includes(r.parcelName)) {
          existing.parcelNames.push(r.parcelName);
        }
        // Promote severity to the worst seen.
        if (severityWeight(ev.severity) > severityWeight(existing.severity)) {
          existing.severity = ev.severity;
          existing.message = ev.message;
        }
      } else {
        map.set(key, {
          type: ev.type,
          severity: ev.severity,
          date: ev.date,
          dayLabel: ev.dayLabel,
          message: ev.message,
          parcelNames: [r.parcelName],
        });
      }
    }
  }
  // Sort by date ascending, then severity descending so first lines are
  // tomorrow's biggest issues.
  return Array.from(map.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return severityWeight(b.severity) - severityWeight(a.severity);
  });
}

function severityWeight(s: WeatherEvent['severity']): number {
  return s === 'alert' ? 3 : s === 'warning' ? 2 : 1;
}

function dedupePestAdvisories(
  results: Array<{ parcelName: string; advisories: ParcelPestAdvisory[] }>,
): DigestPestAdvisory[] {
  const map = new Map<string, DigestPestAdvisory>();
  for (const r of results) {
    for (const adv of r.advisories) {
      const key = adv.advisoryId;
      const existing = map.get(key);
      if (existing) {
        if (!existing.parcelNames.includes(r.parcelName)) {
          existing.parcelNames.push(r.parcelName);
        }
      } else {
        map.set(key, {
          advisoryId: adv.advisoryId,
          pestName: adv.pestName,
          severity: adv.severity,
          province: adv.province,
          comarca: adv.comarca,
          message: adv.message,
          parcelNames: [r.parcelName],
        });
      }
    }
  }
  // Sort by severity (high → low) then alphabetical pest name for stability.
  const sevW = { high: 3, medium: 2, low: 1 } as const;
  return Array.from(map.values()).sort((a, b) => {
    const ds = sevW[b.severity] - sevW[a.severity];
    if (ds !== 0) return ds;
    return a.pestName.localeCompare(b.pestName);
  });
}

// ── Eligible-user enumeration (for the cron) ────────────────────────────

export async function listEligibleDigestUsers(): Promise<IUser[]> {
  const users = await User.find({
    role: { $in: ['farmer', 'cooperative'] },
    digestSubscribed: { $ne: false },
  }).lean<IUser[]>();
  return users.filter((u) => isEligibleDemo(u.googleId));
}
