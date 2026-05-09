/**
 * Seed: 5 farmer "socios" linked to demo-cooperative-001 (DCOOP).
 *
 * Each socio gets 2 olive parcels in Estepa / Sierra Sur DOP zone so the
 * cooperative dashboard sees ~10 parcels / ~150 ha aggregated. Idempotent:
 * users keyed by `googleId`, parcels keyed by `name + ownerId`.
 *
 * Side effect: also re-points the 2 parcels currently owned by
 * demo-cooperative-001 (Olivar DOP Estepa Casariche + Sur) to the first
 * socio. The cooperative is NOT a parcel owner — it only aggregates.
 *
 * Run via:
 *   docker compose exec -T api node apps/api/dist/seed/seedCooperativeSocios.js
 */
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Parcel } from '../models/Parcel.js';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

interface SocioSeed {
  googleId: string;
  email: string;
  name: string;
  phone?: string;
  parcels: ParcelSeed[];
}

interface ParcelSeed {
  name: string;
  cropType: string;
  province: string;
  areaHa: number;
  // small ring around a centroid for a believable orchard polygon
  centroid: [number, number]; // [lng, lat]
  sizeDeg?: number; // ring radius in degrees, default ~0.005 ≈ 500m
  sigpacRef?: string;
}

const COOP_GOOGLE_ID = 'demo-cooperative-001';

// Estepa / Sierra Sur olive country, all within DCOOP olivar territory.
// Centroids are real-ish points in the Sevilla/Málaga olive belt.
const SOCIOS: SocioSeed[] = [
  {
    googleId: 'demo-coop-socio-1',
    email: 'socio1@dcoop-demo.coop',
    name: 'Manuel Reyes Aguilar',
    phone: '+34 600 100 001',
    parcels: [
      { name: 'Olivar Las Pedreras', cropType: 'olivo', province: 'Sevilla', areaHa: 18.5, centroid: [-4.860, 37.290] },
      { name: 'Olivar El Soto',      cropType: 'olivo', province: 'Sevilla', areaHa: 12.2, centroid: [-4.871, 37.302] },
    ],
  },
  {
    googleId: 'demo-coop-socio-2',
    email: 'socio2@dcoop-demo.coop',
    name: 'Hermanos Ruiz Castro',
    phone: '+34 600 100 002',
    parcels: [
      { name: 'Olivar La Atalaya',     cropType: 'olivo', province: 'Sevilla', areaHa: 22.0, centroid: [-4.882, 37.275] },
      { name: 'Olivar Cerro del Aguila', cropType: 'olivo', province: 'Sevilla', areaHa: 15.7, centroid: [-4.895, 37.285] },
    ],
  },
  {
    googleId: 'demo-coop-socio-3',
    email: 'socio3@dcoop-demo.coop',
    name: 'María José Vega Pérez',
    phone: '+34 600 100 003',
    parcels: [
      { name: 'Olivar Los Manantiales', cropType: 'olivo', province: 'Sevilla', areaHa: 9.8,  centroid: [-4.840, 37.310] },
      { name: 'Olivar Casa Bermeja',    cropType: 'olivo', province: 'Sevilla', areaHa: 14.3, centroid: [-4.855, 37.318] },
    ],
  },
  {
    googleId: 'demo-coop-socio-4',
    email: 'socio4@dcoop-demo.coop',
    name: 'Juan Cabrera Lozano',
    phone: '+34 600 100 004',
    parcels: [
      { name: 'Olivar El Puerto',  cropType: 'olivo', province: 'Sevilla', areaHa: 11.1, centroid: [-4.825, 37.270] },
      { name: 'Olivar La Veguilla', cropType: 'olivo', province: 'Sevilla', areaHa: 7.5,  centroid: [-4.812, 37.283] },
    ],
  },
  {
    googleId: 'demo-coop-socio-5',
    email: 'socio5@dcoop-demo.coop',
    name: 'Familia Domínguez Olivos',
    phone: '+34 600 100 005',
    parcels: [
      { name: 'Olivar Cortijo Nuevo', cropType: 'olivo', province: 'Sevilla', areaHa: 26.4, centroid: [-4.901, 37.305] },
      { name: 'Olivar La Loma Alta',  cropType: 'olivo', province: 'Sevilla', areaHa: 19.0, centroid: [-4.888, 37.317] },
    ],
  },
];

function ringFromCentroid(lng: number, lat: number, sizeDeg = 0.005): number[][] {
  // Rough rectangle for demo. Real KMZ imports replace this when the user
  // brings their own polygon. We just need a valid GeoJSON ring.
  const d = sizeDeg;
  return [
    [lng - d, lat - d],
    [lng + d, lat - d],
    [lng + d, lat + d],
    [lng - d, lat + d],
    [lng - d, lat - d], // close ring
  ];
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for cooperative socios seed');

  const coop = await User.findOne({ googleId: COOP_GOOGLE_ID });
  if (!coop) {
    logger.error('Cooperative user demo-cooperative-001 not found — run main seed or login flow first');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Promote the cooperative user to its proper role if it was still a farmer
  if (coop.role !== 'cooperative') {
    coop.role = 'cooperative';
    await coop.save();
    logger.info('Cooperative user role updated to cooperative');
  }

  let userUpserts = 0;
  let parcelUpserts = 0;
  const now = new Date();

  for (const socio of SOCIOS) {
    const userResult = await User.updateOne(
      { googleId: socio.googleId },
      {
        $set: {
          email: socio.email,
          name: socio.name,
          role: 'farmer',
          phone: socio.phone,
          cooperativeId: coop._id,
          isVerified: true,
          rating: 0,
          ratingCount: 0,
          avatar: '/farmer.svg',
          updatedAt: now,
        },
        $setOnInsert: { googleId: socio.googleId, createdAt: now },
      },
      { upsert: true },
    );
    if (userResult.upsertedCount > 0) userUpserts += 1;

    const socioUser = await User.findOne({ googleId: socio.googleId });
    if (!socioUser) continue;

    for (const p of socio.parcels) {
      const ring = ringFromCentroid(p.centroid[0], p.centroid[1], p.sizeDeg);
      const result = await Parcel.updateOne(
        { name: p.name, ownerId: socioUser._id },
        {
          $set: {
            ownerId: socioUser._id,
            name: p.name,
            geometry: { type: 'Polygon', coordinates: [ring] },
            areaHa: p.areaHa,
            cropType: p.cropType,
            province: p.province,
            sigpacRef: p.sigpacRef,
            isActive: true,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
      if (result.upsertedCount > 0) parcelUpserts += 1;
    }
  }

  // The cooperative does NOT own parcels. If demo-cooperative-001 still has
  // any (from a previous seed iteration), re-assign them to the first socio
  // so they keep their NDVI history but flow through the aggregate view.
  const orphanCount = await Parcel.countDocuments({ ownerId: coop._id });
  if (orphanCount > 0) {
    const firstSocio = await User.findOne({ googleId: 'demo-coop-socio-1' });
    if (firstSocio) {
      const reassigned = await Parcel.updateMany(
        { ownerId: coop._id },
        { $set: { ownerId: firstSocio._id, updatedAt: now } },
      );
      logger.info({ reassigned: reassigned.modifiedCount }, 'Re-assigned cooperative-owned parcels to socio-1');
    }
  }

  const totalSocios = await User.countDocuments({ cooperativeId: coop._id });
  const socioIds = await User.find({ cooperativeId: coop._id }, { _id: 1 }).lean();
  const totalParcels = await Parcel.countDocuments({
    ownerId: { $in: socioIds.map((s) => s._id) },
    isActive: true,
  });
  const totalHa = await Parcel.aggregate([
    { $match: { ownerId: { $in: socioIds.map((s) => s._id) }, isActive: true } },
    { $group: { _id: null, total: { $sum: '$areaHa' } } },
  ]);

  logger.info(
    {
      socios: totalSocios,
      parcels: totalParcels,
      hectares: totalHa[0]?.total ?? 0,
      newUsers: userUpserts,
      newParcels: parcelUpserts,
    },
    'Cooperative socios seed complete',
  );

  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error({ err }, 'Cooperative socios seed failed');
  process.exit(1);
});
