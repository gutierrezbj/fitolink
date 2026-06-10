import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { PestAdvisory, type IPestAdvisory, type PestSource, type PestSeverity } from '../models/PestAdvisory.js';
import { Parcel } from '../models/Parcel.js';
import { AppError } from '../utils/AppError.js';
import { polygonCentroid } from '../utils/geo.js';
import type { CropType } from '@fitolink/shared';

/**
 * Pest advisories — Ola 1.5 · Pieza 3 (Camino B).
 *
 * Curated by the agronomist from the official weekly bulletins (RAIF,
 * MAPA, SAIF, SIAM). The system distributes each advisory automatically
 * to the parcels that match by crop type + geographic proximity to any
 * of the advisory's affected areas (default radius: 30 km).
 *
 * Idempotency: every (pestName, source, sourceRef, detected month) gets
 * a stable fingerprint, so duplicate manual entries don't cause double
 * notifications.
 */

// ── Input shape for createAdvisory ─────────────────────────────────────

export interface CreateAdvisoryInput {
  pestName: string;
  scientificName?: string;
  cropTypes: CropType[];
  affectedAreas: Array<{
    province: string;
    comarca?: string;
    /** [lng, lat] */
    centroid: [number, number];
    radiusKm?: number;
  }>;
  severity?: PestSeverity;
  detectedAt?: Date;
  expiresAt?: Date;
  source: PestSource;
  sourceRef?: string;
  recommendation?: string;
  notes?: string;
  sourceUrl?: string;
}

// ── Output shape for the parcel-level endpoint ─────────────────────────

export interface ParcelPestAdvisory {
  advisoryId: string;
  pestName: string;
  scientificName?: string;
  severity: PestSeverity;
  source: PestSource;
  sourceRef?: string;
  detectedAt: string;       // ISO yyyy-mm-dd
  expiresAt: string;
  comarca?: string;
  province: string;
  distanceKm: number;       // distance from the parcel centroid to the matched affected area
  recommendation?: string;
  sourceUrl?: string;
  /** Tipo A friendly Spanish message ready for the morning digest */
  message: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

function fingerprintFor(input: CreateAdvisoryInput): string {
  // Stable hash from the elements an agronomist is least likely to vary
  // when re-entering the same advisory: pest + source + reference, and
  // the year-month of detection. Two clicks on "create" with the same
  // bulletin will collide and prevent the double row.
  const month = (input.detectedAt ?? new Date()).toISOString().slice(0, 7);
  const parts = [
    input.pestName.toLowerCase().trim(),
    input.source,
    (input.sourceRef ?? '').toLowerCase().trim(),
    month,
  ];
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}

function haversineKm(a: [number, number], b: [number, number]): number {
  // a, b in [lng, lat] order. Earth radius = 6371 km.
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const lat1r = toRad(lat1);
  const lat2r = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1r) * Math.cos(lat2r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function isoDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

function buildMessage(a: ParcelPestAdvisory, parcelName: string): string {
  const sevText = a.severity === 'high' ? 'severidad alta' : a.severity === 'low' ? 'severidad baja' : 'severidad media';
  const where = a.comarca ? `comarca de ${a.comarca}` : `provincia de ${a.province}`;
  const rec = a.recommendation ? ` ${a.recommendation}` : ' Sus parcelas entran en seguimiento reforzado los próximos días.';
  const ref = a.sourceRef ? ` Fuente: ${a.source} · ${a.sourceRef}.` : ` Fuente: boletín ${a.source}.`;
  return `Actividad de ${a.pestName} detectada en su ${where}, ${sevText}.${rec}${ref}`;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Create a new advisory. Idempotent: if the (pest, source, ref, month)
 * fingerprint already exists, throws a 409-style AppError rather than
 * silently duplicating.
 */
export async function createAdvisory(
  input: CreateAdvisoryInput,
  creatorId: string,
): Promise<IPestAdvisory> {
  if (!input.cropTypes || input.cropTypes.length === 0) {
    throw AppError.badRequest('Indica al menos un cultivo afectado');
  }
  if (!input.affectedAreas || input.affectedAreas.length === 0) {
    throw AppError.badRequest('Indica al menos una zona afectada');
  }

  const fingerprint = fingerprintFor(input);
  const existing = await PestAdvisory.findOne({ fingerprint });
  if (existing) {
    throw AppError.badRequest(
      `Ya existe un aviso para ${input.pestName} de ${input.source}${input.sourceRef ? ' ' + input.sourceRef : ''} este mes`,
    );
  }

  const advisory = await PestAdvisory.create({
    pestName: input.pestName,
    scientificName: input.scientificName,
    cropTypes: input.cropTypes,
    affectedAreas: input.affectedAreas.map((a) => ({
      province: a.province,
      comarca: a.comarca,
      centroid: { type: 'Point' as const, coordinates: a.centroid },
      radiusKm: a.radiusKm ?? 30,
    })),
    severity: input.severity ?? 'medium',
    detectedAt: input.detectedAt ?? new Date(),
    expiresAt: input.expiresAt,
    source: input.source,
    sourceRef: input.sourceRef,
    recommendation: input.recommendation,
    notes: input.notes,
    sourceUrl: input.sourceUrl,
    createdBy: new mongoose.Types.ObjectId(creatorId),
    fingerprint,
    isActive: true,
  });

  return advisory;
}

export async function listAdvisories(options: {
  activeOnly?: boolean;
  limit?: number;
} = {}): Promise<IPestAdvisory[]> {
  const filter: Record<string, unknown> = {};
  if (options.activeOnly !== false) {
    filter.isActive = true;
    filter.expiresAt = { $gte: new Date() };
  }
  return PestAdvisory.find(filter)
    .sort({ severity: -1, detectedAt: -1 })
    .limit(options.limit ?? 100)
    .lean() as unknown as Promise<IPestAdvisory[]>;
}

export async function deactivateAdvisory(advisoryId: string): Promise<IPestAdvisory> {
  const advisory = await PestAdvisory.findByIdAndUpdate(
    advisoryId,
    { isActive: false },
    { new: true },
  );
  if (!advisory) throw AppError.notFound('Aviso fitosanitario');
  return advisory;
}

/**
 * Pull active advisories that match a parcel's crop type and whose
 * centroid falls within an affected area's radius. Returns the curated
 * shape ready for the widget and the morning digest.
 */
export async function getAdvisoriesForParcel(parcelId: string): Promise<ParcelPestAdvisory[]> {
  const parcel = await Parcel.findById(parcelId)
    .select('_id name cropType geometry')
    .lean();
  if (!parcel) throw AppError.notFound('Parcela');

  const [parcelLng, parcelLat] = polygonCentroid(
    parcel.geometry as { type: 'Polygon'; coordinates: number[][][] },
  );

  // First filter cheaply by crop type + active + not expired. The geo
  // distance check is done in JS because each advisory can have several
  // affected areas with different radii — too custom for $geoNear.
  const candidates = await PestAdvisory.find({
    isActive: true,
    expiresAt: { $gte: new Date() },
    cropTypes: parcel.cropType,
  })
    .sort({ severity: -1, detectedAt: -1 })
    .lean();

  const matches: ParcelPestAdvisory[] = [];
  for (const adv of candidates) {
    for (const area of adv.affectedAreas) {
      const [aLng, aLat] = area.centroid.coordinates as [number, number];
      const distKm = haversineKm([parcelLng, parcelLat], [aLng, aLat]);
      if (distKm <= area.radiusKm) {
        const item: ParcelPestAdvisory = {
          advisoryId: adv._id.toString(),
          pestName: adv.pestName,
          scientificName: adv.scientificName,
          severity: adv.severity,
          source: adv.source,
          sourceRef: adv.sourceRef,
          detectedAt: isoDate(adv.detectedAt),
          expiresAt: isoDate(adv.expiresAt),
          comarca: area.comarca,
          province: area.province,
          distanceKm: Math.round(distKm * 10) / 10,
          recommendation: adv.recommendation,
          sourceUrl: adv.sourceUrl,
          message: '',  // filled below
        };
        item.message = buildMessage(item, parcel.name);
        matches.push(item);
        break;  // count each advisory once even if multiple areas match
      }
    }
  }

  return matches;
}

// ── User-level aggregation (Sprint AlertsPage comarca · 11-jun-2026) ───

export interface UserPestAdvisory extends ParcelPestAdvisory {
  /** Names of the user's parcels inside the advisory radius */
  affectedParcels: Array<{ _id: string; name: string; distanceKm: number }>;
}

/**
 * Pull active advisories that match ANY of the user's parcels, deduped
 * by advisory. Feeds the "§ AVISOS FITOSANITARIOS EN SU COMARCA" section
 * of AlertsPage so the page stays useful even when there are no satellite
 * anomalies on the user's own parcels.
 *
 * One DB query for parcels + one for advisory candidates (crop-filtered);
 * the geo matching runs in JS like getAdvisoriesForParcel because each
 * advisory carries several affected areas with custom radii.
 */
export async function getAdvisoriesForUser(userId: string): Promise<UserPestAdvisory[]> {
  const parcels = await Parcel.find({ ownerId: userId, isActive: true })
    .select('_id name cropType geometry')
    .lean();
  if (parcels.length === 0) return [];

  const cropTypes = [...new Set(parcels.map((p) => p.cropType))];
  const candidates = await PestAdvisory.find({
    isActive: true,
    expiresAt: { $gte: new Date() },
    cropTypes: { $in: cropTypes },
  })
    .sort({ severity: -1, detectedAt: -1 })
    .lean();
  if (candidates.length === 0) return [];

  const centroids = parcels.map((p) => ({
    _id: p._id.toString(),
    name: p.name,
    cropType: p.cropType,
    centroid: polygonCentroid(p.geometry as { type: 'Polygon'; coordinates: number[][][] }),
  }));

  const byAdvisory = new Map<string, UserPestAdvisory>();
  for (const adv of candidates) {
    for (const parcel of centroids) {
      if (!adv.cropTypes.includes(parcel.cropType)) continue;
      for (const area of adv.affectedAreas) {
        const [aLng, aLat] = area.centroid.coordinates as [number, number];
        const distKm = Math.round(haversineKm(parcel.centroid, [aLng, aLat]) * 10) / 10;
        if (distKm > area.radiusKm) continue;

        const key = adv._id.toString();
        let entry = byAdvisory.get(key);
        if (!entry) {
          entry = {
            advisoryId: key,
            pestName: adv.pestName,
            scientificName: adv.scientificName,
            severity: adv.severity,
            source: adv.source,
            sourceRef: adv.sourceRef,
            detectedAt: isoDate(adv.detectedAt),
            expiresAt: isoDate(adv.expiresAt),
            comarca: area.comarca,
            province: area.province,
            distanceKm: distKm,
            recommendation: adv.recommendation,
            sourceUrl: adv.sourceUrl,
            message: '',
            affectedParcels: [],
          };
          entry.message = buildMessage(entry, parcel.name);
          byAdvisory.set(key, entry);
        }
        entry.affectedParcels.push({ _id: parcel._id, name: parcel.name, distanceKm: distKm });
        // Keep the closest match as the advisory's headline distance
        if (distKm < entry.distanceKm) {
          entry.distanceKm = distKm;
          entry.comarca = area.comarca;
          entry.province = area.province;
        }
        break;  // this parcel matched — skip remaining areas of this advisory
      }
    }
  }

  // Severity desc, then proximity asc — most urgent and closest first
  const sevRank: Record<PestSeverity, number> = { high: 0, medium: 1, low: 2 };
  return [...byAdvisory.values()].sort((a, b) => {
    if (sevRank[a.severity] !== sevRank[b.severity]) return sevRank[a.severity] - sevRank[b.severity];
    return a.distanceKm - b.distanceKm;
  });
}
