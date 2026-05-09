import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Parcel } from '../models/Parcel.js';
import { Alert } from '../models/Alert.js';
import { AppError } from '../utils/AppError.js';

/**
 * Cooperative aggregated view.
 *
 * The cooperative user owns no parcels itself. It aggregates the parcels of
 * all farmers whose `cooperativeId` points to it, plus their alerts. This
 * service computes the KPIs and per-member breakdowns the dashboard needs.
 *
 * V1 surface: a single endpoint returns everything (KPIs + members + map
 * geometry). Cheap to render, single round-trip from the UI.
 */

interface MemberSummary {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  parcelCount: number;
  areaHa: number;
  ndviAvg: number | null;
  alertCount: number;
  criticalAlertCount: number;
  worstParcel: {
    _id: string;
    name: string;
    ndvi: number;
  } | null;
}

interface ParcelGeo {
  _id: string;
  name: string;
  cropType: string;
  areaHa: number;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  ndvi: number | null;
  hasActiveAlert: boolean;
  ownerName: string;
}

interface CooperativeOverview {
  cooperative: {
    _id: string;
    name: string;
    company?: string;
  };
  kpis: {
    memberCount: number;
    parcelCount: number;
    areaHa: number;
    ndviAvg: number | null;
    activeAlerts: number;
    criticalAlerts: number;
    parcelsBelowCritical: number; // NDVI < 0.3
  };
  members: MemberSummary[];
  parcels: ParcelGeo[];
}

/** Latest mean NDVI from a parcel's history, or null if empty. */
function latestNdvi(p: { ndviHistory?: { mean: number }[] }): number | null {
  const h = p.ndviHistory;
  if (!h || h.length === 0) return null;
  return h[h.length - 1].mean;
}

export async function getOverview(cooperativeUserId: string): Promise<CooperativeOverview> {
  const coop = await User.findById(cooperativeUserId).lean();
  if (!coop) throw AppError.notFound('Cooperativa');
  if (coop.role !== 'cooperative') {
    throw AppError.forbidden('Este usuario no es una cooperativa');
  }

  // Members of this cooperative
  const members = await User.find({ cooperativeId: coop._id, role: 'farmer' })
    .select('_id name email phone')
    .lean();
  const memberIds = members.map((m) => m._id);

  // All active parcels of all members
  const parcels = await Parcel.find({
    ownerId: { $in: memberIds },
    isActive: true,
  })
    .select('_id name cropType areaHa geometry ndviHistory ownerId')
    .lean();

  // All active alerts on those parcels
  const parcelIds = parcels.map((p) => p._id);
  const alerts = await Alert.find({
    parcelId: { $in: parcelIds },
    status: { $in: ['new', 'notified'] },
  })
    .select('_id parcelId severity ndviValue')
    .lean();

  // Index alerts by parcelId for O(1) lookup
  const alertsByParcel = new Map<string, typeof alerts>();
  for (const a of alerts) {
    const key = a.parcelId.toString();
    const list = alertsByParcel.get(key);
    if (list) list.push(a);
    else alertsByParcel.set(key, [a]);
  }

  // Per-member rollup
  const memberMap = new Map<string, MemberSummary>();
  for (const m of members) {
    memberMap.set(m._id.toString(), {
      _id: m._id.toString(),
      name: m.name,
      email: m.email,
      phone: m.phone,
      parcelCount: 0,
      areaHa: 0,
      ndviAvg: null,
      alertCount: 0,
      criticalAlertCount: 0,
      worstParcel: null,
    });
  }

  // Helper accumulators for ndviAvg
  const ndviAcc = new Map<string, { sum: number; n: number }>();

  for (const p of parcels) {
    const ownerKey = p.ownerId.toString();
    const summary = memberMap.get(ownerKey);
    if (!summary) continue;

    summary.parcelCount += 1;
    summary.areaHa += p.areaHa;

    const ndvi = latestNdvi(p);
    if (ndvi !== null) {
      const acc = ndviAcc.get(ownerKey) ?? { sum: 0, n: 0 };
      acc.sum += ndvi;
      acc.n += 1;
      ndviAcc.set(ownerKey, acc);

      if (!summary.worstParcel || ndvi < summary.worstParcel.ndvi) {
        summary.worstParcel = { _id: p._id.toString(), name: p.name, ndvi };
      }
    }

    const parcelAlerts = alertsByParcel.get(p._id.toString()) ?? [];
    summary.alertCount += parcelAlerts.length;
    summary.criticalAlertCount += parcelAlerts.filter((a) => a.severity === 'critical').length;
  }

  for (const [k, acc] of ndviAcc) {
    const s = memberMap.get(k);
    if (s) s.ndviAvg = Number((acc.sum / acc.n).toFixed(3));
  }

  // Cooperative-wide KPIs
  const totalParcels = parcels.length;
  const totalArea = parcels.reduce((s, p) => s + p.areaHa, 0);
  const ndviValues = parcels
    .map(latestNdvi)
    .filter((v): v is number => v !== null);
  const ndviAvg =
    ndviValues.length > 0
      ? Number((ndviValues.reduce((a, b) => a + b, 0) / ndviValues.length).toFixed(3))
      : null;
  const parcelsBelowCritical = ndviValues.filter((v) => v < 0.3).length;

  // Parcels for the map — include per-parcel current NDVI + alert flag + owner
  const parcelGeo: ParcelGeo[] = parcels.map((p) => {
    const owner = memberMap.get(p.ownerId.toString());
    return {
      _id: p._id.toString(),
      name: p.name,
      cropType: p.cropType,
      areaHa: p.areaHa,
      geometry: p.geometry as { type: 'Polygon'; coordinates: number[][][] },
      ndvi: latestNdvi(p),
      hasActiveAlert: (alertsByParcel.get(p._id.toString()) ?? []).length > 0,
      ownerName: owner?.name ?? '—',
    };
  });

  return {
    cooperative: {
      _id: coop._id.toString(),
      name: coop.name,
      company: coop.company,
    },
    kpis: {
      memberCount: members.length,
      parcelCount: totalParcels,
      areaHa: Number(totalArea.toFixed(1)),
      ndviAvg,
      activeAlerts: alerts.length,
      criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
      parcelsBelowCritical,
    },
    members: [...memberMap.values()].sort((a, b) => {
      // Members with critical alerts first, then by alert count, then by NDVI ascending
      if (a.criticalAlertCount !== b.criticalAlertCount) return b.criticalAlertCount - a.criticalAlertCount;
      if (a.alertCount !== b.alertCount) return b.alertCount - a.alertCount;
      const av = a.ndviAvg ?? 1;
      const bv = b.ndviAvg ?? 1;
      return av - bv;
    }),
    parcels: parcelGeo,
  };
}

// Ensure TS keeps mongoose import as used (for some builds)
export type _CooperativeOverview = CooperativeOverview;
void mongoose;
