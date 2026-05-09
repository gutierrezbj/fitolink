import { User } from '../models/User.js';
import { Parcel } from '../models/Parcel.js';
import { Alert } from '../models/Alert.js';
import { Operation } from '../models/Operation.js';
import { Lead } from '../models/Lead.js';
import { Provider } from '../models/Provider.js';
import { NdviSnapshot } from '../models/NdviSnapshot.js';

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
