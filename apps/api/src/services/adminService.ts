import mongoose from 'mongoose';
import { OPERATION_STATUSES, type OperationStatus } from '@fitolink/shared';
import { User } from '../models/User.js';
import { Parcel } from '../models/Parcel.js';
import { Alert } from '../models/Alert.js';
import { Operation } from '../models/Operation.js';
import { Lead } from '../models/Lead.js';
import { Provider } from '../models/Provider.js';
import { NdviSnapshot } from '../models/NdviSnapshot.js';
import { AppError } from '../utils/AppError.js';

/**
 * Admin platform KPIs.
 *
 * Aggregates platform-wide health, activity, ops, commercial and
 * satellite-data metrics. Single endpoint, all aggregations server-side so the
 * dashboard renders fast and we don't ship raw collections to the client.
 */

export interface AdminKpis {
  // 1. Platform health
  health: {
    lastPipelineRun: Date | null;
    parcelsTotal: number;
    parcelsFreshLt7d: number;
    parcelsFreshLt30d: number;
    mpcCoverage: {
      withModis: number;
      withClimate: number;
      withThermal: number;
      withAll: number;
    };
  };
  // 2. Activity
  activity: {
    usersTotal: number;
    usersByRole: Record<string, number>;
    hectaresMonitored: number;
    parcelsActive: number;
    parcelsInsured: number;
  };
  // 3. Operations
  operations: {
    alertsActive: number;
    alertsCritical: number;
    opsByStatus: Record<string, number>;
    opsLast30d: number;
    avgAlertToCompletedHours: number | null;
  };
  // 4. Commercial
  commercial: {
    leadsPending: number;
    leadsByType: Record<string, number>;
    providersTotal: number;
    providersByCategory: Record<string, number>;
  };
  // 5. Satellite data
  satellite: {
    ndviReadingsTotal: number;
    snapshotsTotal: number;
    parcelsWithThermal: number;
  };
}

export async function getKpis(): Promise<AdminKpis> {
  // Run independent queries in parallel.
  const [users, parcels, alerts, operations, leads, providers, snapshotsTotal] = await Promise.all([
    User.find({}).select('role').lean(),
    Parcel.find({ isActive: true })
      .select('areaHa isInsured ndviHistory thermal modisBaseline climateBaseline')
      .lean(),
    Alert.find({ status: { $in: ['new', 'notified'] } }).select('severity').lean(),
    Operation.find({}).select('status type alertId completedAt createdAt').lean(),
    Lead.find({ status: { $in: ['new', 'contacted'] } }).select('type status').lean(),
    Provider.find({}).select('category').lean(),
    NdviSnapshot.estimatedDocumentCount(),
  ]);

  // ── 1. Platform health ────────────────────────────────────────────────
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  let lastPipelineRun: Date | null = null;
  let parcelsFreshLt7d = 0;
  let parcelsFreshLt30d = 0;
  let parcelsWithModis = 0;
  let parcelsWithClimate = 0;
  let parcelsWithThermal = 0;
  let parcelsWithAll = 0;
  let ndviReadingsTotal = 0;
  let hectaresMonitored = 0;
  let parcelsInsured = 0;

  for (const p of parcels) {
    const h = p.ndviHistory ?? [];
    ndviReadingsTotal += h.length;
    hectaresMonitored += p.areaHa ?? 0;
    if (p.isInsured) parcelsInsured += 1;

    if (h.length > 0) {
      const last = h[h.length - 1].date;
      const t = new Date(last).getTime();
      if (!lastPipelineRun || t > lastPipelineRun.getTime()) {
        lastPipelineRun = new Date(last);
      }
      if (now - t < SEVEN_DAYS) parcelsFreshLt7d += 1;
      if (now - t < THIRTY_DAYS) parcelsFreshLt30d += 1;
    }

    const hasModis = !!p.modisBaseline;
    const hasClimate = !!p.climateBaseline;
    const hasThermal = !!p.thermal;
    if (hasModis) parcelsWithModis += 1;
    if (hasClimate) parcelsWithClimate += 1;
    if (hasThermal) parcelsWithThermal += 1;
    if (hasModis && hasClimate && hasThermal) parcelsWithAll += 1;
  }

  // ── 2. Activity ───────────────────────────────────────────────────────
  const usersByRole: Record<string, number> = {};
  for (const u of users) {
    usersByRole[u.role] = (usersByRole[u.role] ?? 0) + 1;
  }

  // ── 3. Operations ─────────────────────────────────────────────────────
  const opsByStatus: Record<string, number> = {};
  let opsLast30d = 0;
  let alertOpDeltaSum = 0;
  let alertOpDeltaN = 0;

  // For mean alert→completed time we need detectedAt from alerts. Pull the
  // alerts referenced by completed operations once.
  const completedOpsWithAlert = operations.filter(
    (o) => o.status === 'completed' && o.alertId && o.completedAt,
  );
  const alertIdsForOps = completedOpsWithAlert.map((o) => o.alertId).filter(Boolean);
  let alertDetectedMap = new Map<string, Date>();
  if (alertIdsForOps.length > 0) {
    const refAlerts = await Alert.find({ _id: { $in: alertIdsForOps } })
      .select('detectedAt')
      .lean();
    alertDetectedMap = new Map(refAlerts.map((a) => [a._id.toString(), a.detectedAt]));
  }

  for (const op of operations) {
    opsByStatus[op.status] = (opsByStatus[op.status] ?? 0) + 1;
    if (op.createdAt && now - new Date(op.createdAt).getTime() < THIRTY_DAYS) {
      opsLast30d += 1;
    }
    if (op.alertId && op.completedAt && op.status === 'completed') {
      const detected = alertDetectedMap.get(op.alertId.toString());
      if (detected) {
        const deltaH =
          (new Date(op.completedAt).getTime() - new Date(detected).getTime()) /
          (60 * 60 * 1000);
        if (deltaH >= 0) {
          alertOpDeltaSum += deltaH;
          alertOpDeltaN += 1;
        }
      }
    }
  }

  const avgAlertToCompletedHours =
    alertOpDeltaN > 0 ? Number((alertOpDeltaSum / alertOpDeltaN).toFixed(1)) : null;

  // ── 4. Commercial ─────────────────────────────────────────────────────
  const leadsByType: Record<string, number> = {};
  for (const l of leads) {
    leadsByType[l.type] = (leadsByType[l.type] ?? 0) + 1;
  }
  const providersByCategory: Record<string, number> = {};
  for (const pr of providers) {
    providersByCategory[pr.category] = (providersByCategory[pr.category] ?? 0) + 1;
  }

  // ── Compose ───────────────────────────────────────────────────────────
  return {
    health: {
      lastPipelineRun,
      parcelsTotal: parcels.length,
      parcelsFreshLt7d,
      parcelsFreshLt30d,
      mpcCoverage: {
        withModis: parcelsWithModis,
        withClimate: parcelsWithClimate,
        withThermal: parcelsWithThermal,
        withAll: parcelsWithAll,
      },
    },
    activity: {
      usersTotal: users.length,
      usersByRole,
      hectaresMonitored: Number(hectaresMonitored.toFixed(1)),
      parcelsActive: parcels.length,
      parcelsInsured,
    },
    operations: {
      alertsActive: alerts.length,
      alertsCritical: alerts.filter((a) => a.severity === 'critical').length,
      opsByStatus,
      opsLast30d,
      avgAlertToCompletedHours,
    },
    commercial: {
      leadsPending: leads.length,
      leadsByType,
      providersTotal: providers.length,
      providersByCategory,
    },
    satellite: {
      ndviReadingsTotal,
      snapshotsTotal: snapshotsTotal,
      parcelsWithThermal,
    },
  };
}

// ── Timeline analytics — Ola 1.3 (OverWatch pattern) ────────────────────

export interface AlertTimelineBucket {
  weekStart: string;       // ISO date of bucket Monday
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface AlertTimelineResponse {
  weeks: number;
  buckets: AlertTimelineBucket[];
  bySeverity: { critical: number; high: number; medium: number; low: number };
  byType: Record<string, number>;
  topParcels: Array<{ parcelId: string; parcelName: string; count: number }>;
}

/**
 * Alerts aggregated by week + severity + type + top parcels.
 * Used to render the dashboard timeline chart, severity donut, and "top 5
 * problem parcels" horizontal bar. Single round-trip; cheap because alerts
 * are a small collection.
 */
export async function getAlertTimeline(weeks = 8): Promise<AlertTimelineResponse> {
  const now = Date.now();
  const windowMs = weeks * 7 * 24 * 60 * 60 * 1000;
  const from = new Date(now - windowMs);

  // Anchor to UTC Monday so buckets are stable regardless of TZ
  const mondayUtc = (d: Date): Date => {
    const t = new Date(d);
    t.setUTCHours(0, 0, 0, 0);
    const dow = t.getUTCDay(); // 0=Sun..6=Sat
    const offset = dow === 0 ? -6 : 1 - dow;
    t.setUTCDate(t.getUTCDate() + offset);
    return t;
  };

  // Pre-create empty buckets so weeks with zero alerts still appear
  const firstMonday = mondayUtc(from);
  const lastMonday = mondayUtc(new Date(now));
  const bucketMap = new Map<string, AlertTimelineBucket>();
  for (let t = firstMonday.getTime(); t <= lastMonday.getTime(); t += 7 * 24 * 60 * 60 * 1000) {
    const key = new Date(t).toISOString().slice(0, 10);
    bucketMap.set(key, { weekStart: key, critical: 0, high: 0, medium: 0, low: 0, total: 0 });
  }

  const alerts = await Alert.find({ detectedAt: { $gte: from } })
    .select('severity type detectedAt parcelId')
    .populate('parcelId', 'name')
    .lean();

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const byType: Record<string, number> = {};
  const parcelCounts = new Map<string, { name: string; count: number }>();

  for (const a of alerts) {
    const sev = a.severity as keyof typeof bySeverity;
    bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
    byType[a.type] = (byType[a.type] ?? 0) + 1;

    const week = mondayUtc(new Date(a.detectedAt)).toISOString().slice(0, 10);
    const bucket = bucketMap.get(week);
    if (bucket) {
      bucket[sev] += 1;
      bucket.total += 1;
    }

    const parcel = a.parcelId as unknown as { _id: { toString(): string }; name?: string } | null;
    if (parcel) {
      const key = parcel._id.toString();
      const entry = parcelCounts.get(key) ?? { name: parcel.name ?? 'Parcela', count: 0 };
      entry.count += 1;
      parcelCounts.set(key, entry);
    }
  }

  const topParcels = [...parcelCounts.entries()]
    .map(([parcelId, e]) => ({ parcelId, parcelName: e.name, count: e.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const buckets = [...bucketMap.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  return { weeks, buckets, bySeverity, byType, topParcels };
}

// ── Gestión de usuarios / operaciones (admin) ──────────────────────────

/**
 * Listado de usuarios para el panel admin.
 *
 * PII mínima: se devuelven SOLO los campos que el dashboard renderiza
 * (AdminUsersPage). Se excluyen deliberadamente `phone` y `location`
 * (datos personales que la UI no pinta) además de `googleId`. Si el panel
 * llega a necesitar más campos, ampliar esta lista de forma explícita.
 */
const ADMIN_USER_FIELDS =
  'name email role isVerified company rating ratingCount certifications equipment createdAt';

export async function listUsers() {
  return User.find({})
    .select(ADMIN_USER_FIELDS)
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Asignación manual de piloto a una operación.
 *
 * Valida que el id de operación y el de piloto sean ObjectId reales
 * (Mongoose 8 NO lanza ante un id inválido — silenciosamente no encuentra
 * o, peor, corrompe el doc) y que el piloto exista de verdad con rol
 * 'pilot'. Cualquier entrada inválida → AppError.badRequest (400), nunca
 * un 500 sin capturar.
 */
export async function assignPilot(operationId: string, pilotId: unknown) {
  if (!mongoose.isValidObjectId(operationId)) {
    throw AppError.badRequest('id de operacion invalido');
  }
  if (typeof pilotId !== 'string' || !mongoose.isValidObjectId(pilotId)) {
    throw AppError.badRequest('pilotId invalido');
  }

  // El piloto debe existir y tener rol 'pilot' antes de asignar.
  const pilot = await User.findOne({ _id: pilotId, role: 'pilot' }).select('_id').lean();
  if (!pilot) {
    throw AppError.badRequest('Piloto no encontrado o el usuario no es piloto');
  }

  const op = await Operation.findByIdAndUpdate(
    operationId,
    { pilotId, status: 'assigned' },
    { new: true },
  )
    .populate('parcelId', 'name cropType province areaHa')
    .populate('farmerId', 'name email phone')
    .populate('pilotId', 'name email phone rating')
    .populate('alertId', 'type severity ndviValue ndviDelta');

  if (!op) {
    throw AppError.notFound('Operacion');
  }
  return op;
}

/**
 * Override de estado de una operación por parte del admin.
 *
 * Valida el ObjectId de la operación y que el estado pertenezca al enum
 * canónico (OPERATION_STATUSES en @fitolink/shared). Estado o id inválido
 * → 400, nunca 500.
 */
export async function updateOperationStatus(operationId: string, status: unknown) {
  if (!mongoose.isValidObjectId(operationId)) {
    throw AppError.badRequest('id de operacion invalido');
  }
  if (typeof status !== 'string' || !OPERATION_STATUSES.includes(status as OperationStatus)) {
    throw AppError.badRequest(
      `status invalido (esperado: ${OPERATION_STATUSES.join(', ')})`,
    );
  }

  const op = await Operation.findByIdAndUpdate(
    operationId,
    { status },
    { new: true },
  ).lean();

  if (!op) {
    throw AppError.notFound('Operacion');
  }
  return op;
}

/**
 * Listado de operaciones para el dispatcher admin, con el contexto
 * completo poblado. Filtro opcional por estado (validado contra el enum;
 * un estado desconocido devuelve lista vacía en lugar de 500).
 */
export async function listOperations(status?: unknown) {
  const filter: Record<string, unknown> = {};
  if (typeof status === 'string' && OPERATION_STATUSES.includes(status as OperationStatus)) {
    filter.status = status;
  }

  return Operation.find(filter)
    .populate('parcelId', 'name cropType province areaHa sigpacRef geometry')
    .populate('farmerId', 'name email phone')
    .populate('pilotId', 'name email phone rating')
    .populate('alertId', 'type severity ndviValue ndviDelta aiConfidence')
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Pilotos verificados disponibles para asignación manual.
 */
export async function listVerifiedPilots() {
  return User.find({ role: 'pilot', isVerified: true })
    .select('name email phone rating ratingCount operationalRadiusKm certifications equipment location')
    .sort({ rating: -1 })
    .lean();
}
