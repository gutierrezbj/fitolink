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

interface NdviSeed {
  date: string; // ISO yyyy-mm-dd
  mean: number;
  min: number;
  max: number;
  anomalyDetected: boolean;
}

interface ParcelSeed {
  name: string;
  cropType: string;
  province: string;
  areaHa: number;
  centroid: [number, number]; // [lng, lat]
  sizeDeg?: number;
  sigpacRef?: string;
  // NDVI history sintético plausible para que la demo se vea con KPIs
  // reales sin esperar 5 días al pipeline Sentinel-2. Patrón identico
  // a seedProfessorDemo (Aula Jaén). 05-jun-2026.
  ndviHistory?: NdviSeed[];
}

const REGANTES_GOOGLE_ID = 'demo-regantes-001';

// Vega Baja del Segura · zona regable concreta y coherente (Alicante +
// Murcia adyacentes). 05-jun-2026: re-concentradas las coords (antes
// dispersas en Valencia+Murcia+Alicante, el mapa no las mostraba todas
// juntas). Una Comunidad de Regantes real opera UNA cuenca, no 3.
// Centroides en municipios reales: Orihuela, Almoradí, Callosa Segura,
// Catral, Cox, Granja de Rocamora, Bigastro, Daya Nueva.
//
// Estados NDVI variados para que los KPIs del dashboard se llenen:
//  · Socio 1 · 2 cítricos sanos (0.55-0.65)
//  · Socio 2 · 1 cítrico sano + 1 cítrico estresado (NDVI bajando)
//  · Socio 3 · 1 hortícola medio + 1 cítrico crítico (NDVI<0.30)
//  · Socio 4 · 2 frutales sanos
// → KPIs esperados: 2 parcelas en estrés (25%), 1 crítica, NDVI medio ~0.50
const SOCIOS: SocioSeed[] = [
  {
    googleId: 'demo-reg-socio-1',
    email: 'socio1@regantes-demo.es',
    name: 'José Ramón Pérez García',
    phone: '+34 600 200 001',
    parcels: [
      {
        name: 'Cítricos Vega Baja',
        cropType: 'citrico', province: 'Alicante', areaHa: 8.4,
        centroid: [-0.940, 38.085], // Orihuela
        ndviHistory: [
          { date: '2026-04-15', mean: 0.58, min: 0.42, max: 0.71, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.61, min: 0.46, max: 0.74, anomalyDetected: false },
          { date: '2026-05-05', mean: 0.64, min: 0.49, max: 0.76, anomalyDetected: false },
          { date: '2026-05-15', mean: 0.66, min: 0.51, max: 0.78, anomalyDetected: false },
          { date: '2026-05-25', mean: 0.65, min: 0.50, max: 0.77, anomalyDetected: false },
        ],
      },
      {
        name: 'Hortícola El Soto',
        cropType: 'hortaliza', province: 'Alicante', areaHa: 3.2,
        centroid: [-0.945, 38.092], // Orihuela norte
        ndviHistory: [
          { date: '2026-04-15', mean: 0.52, min: 0.38, max: 0.66, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.55, min: 0.40, max: 0.68, anomalyDetected: false },
          { date: '2026-05-05', mean: 0.58, min: 0.43, max: 0.70, anomalyDetected: false },
          { date: '2026-05-15', mean: 0.56, min: 0.41, max: 0.69, anomalyDetected: false },
          { date: '2026-05-25', mean: 0.59, min: 0.44, max: 0.71, anomalyDetected: false },
        ],
      },
    ],
  },
  {
    googleId: 'demo-reg-socio-2',
    email: 'socio2@regantes-demo.es',
    name: 'Hermanos Martínez Cortés',
    phone: '+34 600 200 002',
    parcels: [
      {
        name: 'Cítricos La Alquería',
        cropType: 'citrico', province: 'Alicante', areaHa: 12.7,
        centroid: [-0.875, 38.123], // Callosa de Segura
        ndviHistory: [
          { date: '2026-04-15', mean: 0.60, min: 0.45, max: 0.73, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.62, min: 0.47, max: 0.75, anomalyDetected: false },
          { date: '2026-05-05', mean: 0.61, min: 0.46, max: 0.74, anomalyDetected: false },
          { date: '2026-05-15', mean: 0.63, min: 0.48, max: 0.76, anomalyDetected: false },
          { date: '2026-05-25', mean: 0.62, min: 0.47, max: 0.75, anomalyDetected: false },
        ],
      },
      {
        // SOCIO 2 · PARCELA EN ESTRÉS · NDVI descendente, cruza umbral 0.40
        name: 'Frutal de Hueso Sur',
        cropType: 'frutal', province: 'Alicante', areaHa: 6.5,
        centroid: [-0.860, 38.108], // Cox
        ndviHistory: [
          { date: '2026-04-15', mean: 0.55, min: 0.40, max: 0.68, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.50, min: 0.36, max: 0.64, anomalyDetected: false },
          { date: '2026-05-05', mean: 0.45, min: 0.30, max: 0.59, anomalyDetected: false },
          { date: '2026-05-15', mean: 0.41, min: 0.26, max: 0.55, anomalyDetected: true },
          { date: '2026-05-25', mean: 0.38, min: 0.23, max: 0.52, anomalyDetected: true },
        ],
      },
    ],
  },
  {
    googleId: 'demo-reg-socio-3',
    email: 'socio3@regantes-demo.es',
    name: 'Carmen López Navarro',
    phone: '+34 600 200 003',
    parcels: [
      {
        name: 'Hortícola Las Norias',
        cropType: 'hortaliza', province: 'Alicante', areaHa: 4.1,
        centroid: [-0.792, 38.158], // Catral
        ndviHistory: [
          { date: '2026-04-15', mean: 0.48, min: 0.34, max: 0.62, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.51, min: 0.36, max: 0.65, anomalyDetected: false },
          { date: '2026-05-05', mean: 0.47, min: 0.33, max: 0.61, anomalyDetected: false },
          { date: '2026-05-15', mean: 0.45, min: 0.31, max: 0.59, anomalyDetected: false },
          { date: '2026-05-25', mean: 0.43, min: 0.29, max: 0.57, anomalyDetected: false },
        ],
      },
      {
        // SOCIO 3 · PARCELA CRÍTICA · NDVI<0.30 — necesita riego YA
        name: 'Cítricos El Palmeral',
        cropType: 'citrico', province: 'Murcia', areaHa: 5.8,
        centroid: [-0.793, 38.103], // Almoradí (sur Vega Baja)
        ndviHistory: [
          { date: '2026-04-15', mean: 0.42, min: 0.28, max: 0.56, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.37, min: 0.23, max: 0.51, anomalyDetected: true },
          { date: '2026-05-05', mean: 0.33, min: 0.20, max: 0.47, anomalyDetected: true },
          { date: '2026-05-15', mean: 0.30, min: 0.18, max: 0.44, anomalyDetected: true },
          { date: '2026-05-25', mean: 0.27, min: 0.15, max: 0.41, anomalyDetected: true },
        ],
      },
    ],
  },
  {
    googleId: 'demo-reg-socio-4',
    email: 'socio4@regantes-demo.es',
    name: 'Familia Sánchez Beltrán',
    phone: '+34 600 200 004',
    parcels: [
      {
        name: 'Frutal La Cañada',
        cropType: 'frutal', province: 'Alicante', areaHa: 9.2,
        centroid: [-0.832, 38.118], // Granja de Rocamora
        ndviHistory: [
          { date: '2026-04-15', mean: 0.57, min: 0.42, max: 0.70, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.60, min: 0.45, max: 0.72, anomalyDetected: false },
          { date: '2026-05-05', mean: 0.63, min: 0.48, max: 0.75, anomalyDetected: false },
          { date: '2026-05-15', mean: 0.65, min: 0.50, max: 0.77, anomalyDetected: false },
          { date: '2026-05-25', mean: 0.64, min: 0.49, max: 0.76, anomalyDetected: false },
        ],
      },
      {
        name: 'Cítricos El Calar',
        cropType: 'citrico', province: 'Alicante', areaHa: 7.6,
        centroid: [-0.820, 38.135], // Bigastro
        ndviHistory: [
          { date: '2026-04-15', mean: 0.59, min: 0.44, max: 0.72, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.61, min: 0.46, max: 0.74, anomalyDetected: false },
          { date: '2026-05-05', mean: 0.62, min: 0.47, max: 0.75, anomalyDetected: false },
          { date: '2026-05-15', mean: 0.60, min: 0.45, max: 0.73, anomalyDetected: false },
          { date: '2026-05-25', mean: 0.61, min: 0.46, max: 0.74, anomalyDetected: false },
        ],
      },
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
      // 05-jun-2026: incluimos ndviHistory en el $set para que la demo se
      // vea con KPIs reales sin esperar 5d al pipeline Sentinel-2. Marcadas
      // como isSyntheticDemo=true para que el pipeline V2 NO las pise con
      // datos reales (mismo flag que Aula Jaén).
      const ndviHistory = (p.ndviHistory ?? []).map((r) => ({
        date: new Date(r.date),
        mean: r.mean,
        min: r.min,
        max: r.max,
        anomalyDetected: r.anomalyDetected,
        source: 'sentinel2' as const,
      }));
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
            isSyntheticDemo: true,
            ndviHistory,
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
