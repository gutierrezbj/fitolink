/**
 * Seed: Comunidad de Regantes demo (demo-regantes-001) + 4 farmer "socios"
 * + 8 parcelas regables en Levante (Comunidad Valenciana / Murcia).
 *
 * Patrón idéntico a seedCooperativeSocios.ts pero con foco en zona
 * regable real (Levante: citricultura + frutal + hortícola), no en
 * olivar Estepa. Esto es lo coherente con el buyer Comunidad de Regantes
 * cuya pelea 2026 es la sequía + RD 950/2024 reducción consumo agua.
 *
 * UPSERTS · idempotente:
 *   1. Crea/promociona usuario `demo-regantes-001` con role='regantes'
 *   2. Upsert 4 socios farmer con `cooperativeId` apuntando a la comunidad
 *   3. Upsert 8 parcelas (2 por socio) con geometrías en zona regable
 *
 * Run via:
 *   docker compose exec -T api node apps/api/dist/seed/seedRegantesSocios.js
 *
 * Sprint Comunidad de Regantes · 05-jun-2026.
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
  centroid: [number, number]; // [lng, lat]
  sizeDeg?: number;
  sigpacRef?: string;
}

const REGANTES_GOOGLE_ID = 'demo-regantes-001';

// Levante regable: Vega Baja del Segura (Murcia/Alicante) + Ribera del
// Júcar. Cítricos + frutales + hortícolas — los cultivos con mayor
// dependencia de riego y por tanto los más sensibles a la sequía 2024-26.
const SOCIOS: SocioSeed[] = [
  {
    googleId: 'demo-reg-socio-1',
    email: 'socio1@regantes-demo.es',
    name: 'José Ramón Pérez García',
    phone: '+34 600 200 001',
    parcels: [
      { name: 'Cítricos Vega Baja', cropType: 'citrico', province: 'Alicante', areaHa: 8.4, centroid: [-0.846, 38.106] },
      { name: 'Hortícola El Soto',  cropType: 'hortaliza', province: 'Alicante', areaHa: 3.2, centroid: [-0.852, 38.112] },
    ],
  },
  {
    googleId: 'demo-reg-socio-2',
    email: 'socio2@regantes-demo.es',
    name: 'Hermanos Martínez Cortés',
    phone: '+34 600 200 002',
    parcels: [
      { name: 'Cítricos La Alquería', cropType: 'citrico', province: 'Valencia', areaHa: 12.7, centroid: [-0.502, 39.182] },
      { name: 'Frutal de Hueso Sur',  cropType: 'frutal', province: 'Valencia', areaHa: 6.5,  centroid: [-0.518, 39.171] },
    ],
  },
  {
    googleId: 'demo-reg-socio-3',
    email: 'socio3@regantes-demo.es',
    name: 'Carmen López Navarro',
    phone: '+34 600 200 003',
    parcels: [
      { name: 'Cítricos El Palmeral', cropType: 'citrico', province: 'Murcia', areaHa: 5.8, centroid: [-1.166, 38.040] },
      { name: 'Hortícola Las Norias', cropType: 'hortaliza', province: 'Murcia', areaHa: 4.1, centroid: [-1.178, 38.052] },
    ],
  },
  {
    googleId: 'demo-reg-socio-4',
    email: 'socio4@regantes-demo.es',
    name: 'Familia Sánchez Beltrán',
    phone: '+34 600 200 004',
    parcels: [
      { name: 'Frutal La Cañada',   cropType: 'frutal', province: 'Valencia', areaHa: 9.2, centroid: [-0.461, 39.158] },
      { name: 'Cítricos El Calar',  cropType: 'citrico', province: 'Valencia', areaHa: 7.6, centroid: [-0.475, 39.165] },
    ],
  },
];

function ringFromCentroid(lng: number, lat: number, sizeDeg = 0.004): number[][] {
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
  logger.info('Connected to MongoDB for regantes socios seed');

  // 1) Upsert de la Comunidad de Regantes demo. Igual que seedCooperativeSocios
  // refactor del 05-jun-2026 — el script NO depende de seed.ts principal.
  await User.updateOne(
    { googleId: REGANTES_GOOGLE_ID },
    {
      $set: {
        email: 'comunidad@regantes-demo.es',
        name: 'Comunidad de Regantes Demo · Vega Baja',
        role: 'regantes',
        company: 'Comunidad de Regantes Demo (sintética)',
        isVerified: true,
        avatar: '/provider-cooperative.svg',
        updatedAt: new Date(),
      },
      $unset: { location: '' },
      $setOnInsert: { googleId: REGANTES_GOOGLE_ID, createdAt: new Date() },
    },
    { upsert: true },
  );
  const comunidad = await User.findOne({ googleId: REGANTES_GOOGLE_ID });
  if (!comunidad) {
    logger.error('Regantes user demo-regantes-001 upsert failed');
    await mongoose.disconnect();
    process.exit(1);
  }
  logger.info({ comunidadId: comunidad._id }, 'Regantes user ready');

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
          cooperativeId: comunidad._id,
          isVerified: true,
          rating: 0,
          ratingCount: 0,
          avatar: '/farmer.svg',
          updatedAt: now,
        },
        $unset: { location: '' },
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

  const totalSocios = await User.countDocuments({ cooperativeId: comunidad._id });
  const socioIds = await User.find({ cooperativeId: comunidad._id }, { _id: 1 }).lean();
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
    'Regantes socios seed complete',
  );

  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error({ err }, 'Regantes socios seed failed');
  process.exit(1);
});
