/**
 * Seed: Comunidad de Regantes demo (demo-regantes-001) + 4 farmer "socios"
 * + 8 parcelas con **GEOMETRÍAS SIGPAC CATASTRALES REALES** en Vega Baja
 * del Segura (Alicante · provincia 03).
 *
 * v3 · 05-jun-2026 · Aula Jaén v2 pattern aplicado a regantes.
 *
 * ANTES (v1): polígonos sintéticos `ringFromCentroid` cuadrados de 888×888m
 * sobre suelo árido. Un gerente real de Comunidad de Regantes veía eso y
 * "nos saca a patadas" (cita JuanCho 05-jun). Sin credibilidad cero.
 *
 * AHORA (v3): descargamos geometrías catastrales reales desde SIGPAC vía
 * `fetchByReference` del sigpacService. Cualquier técnico de regantes
 * puede pegar la ref en el visor SIGPAC oficial y ver EXACTAMENTE el
 * mismo polígono. Cero invento. Auditable. Patrón AgroM: ciencia, no
 * marketing.
 *
 * **8 referencias SIGPAC verificadas** (sondeo manual 05-jun-2026,
 * todas con coef_regadio=100 = 100% en regadío, requisito Comunidad
 * de Regantes):
 *
 *   Orihuela (muni 99):
 *     03/99/0/0/3/10/1 · CI · 4.23 ha · cítrico
 *     03/99/0/0/4/1/1  · CI · 3.96 ha · cítrico
 *     03/99/0/0/4/5/1  · CI · 4.72 ha · cítrico
 *     03/99/0/0/3/7/1  · CI · 4.44 ha · cítrico
 *     03/99/0/0/3/30/1 · FY · 1.99 ha · frutal
 *
 *   Almoradí (muni 70):
 *     03/70/0/0/3/1/1  · CI · 2.06 ha · cítrico
 *
 *   Callosa de Segura (muni 49):
 *     03/49/0/0/4/1/1  · TA · 2.30 ha · hortícola
 *     03/49/0/0/4/10/1 · FY · 1.20 ha · frutal
 *
 * Total: ~25 ha · 5 cítricos + 2 frutales + 1 hortícola (mix realista
 * Vega Baja: dominante cítrico, regadío del Segura).
 *
 * Run via:
 *   docker compose exec -T api node apps/api/dist/seed/seedRegantesSocios.js
 */
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Parcel } from '../models/Parcel.js';
import { logger } from '../utils/logger.js';
import { fetchByReference } from '../services/sigpacService.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

interface SigpacRef {
  prov: string;
  muni: string;
  agre: string;
  zona: string;
  poligono: string;
  parcela: string;
  recinto: string;
}

interface NdviSeed {
  date: string;
  mean: number;
  min: number;
  max: number;
  anomalyDetected: boolean;
}

interface ParcelSeed {
  name: string;
  cropType: string;
  province: string;
  sigpacRef: SigpacRef;
  ndviHistory: NdviSeed[];
}

interface SocioSeed {
  googleId: string;
  email: string;
  name: string;
  phone?: string;
  parcels: ParcelSeed[];
}

const REGANTES_GOOGLE_ID = 'demo-regantes-001';

// Estados NDVI plausibles para que los KPIs del dashboard se llenen:
//  · 6 parcelas sanas (NDVI 0.55-0.65)
//  · 1 frutal Hermanos Martínez · ESTRÉS descendente (NDVI 0.55 → 0.38)
//  · 1 frutal Carmen López · CRÍTICO (NDVI 0.42 → 0.27, anomaly)
// → KPIs esperados: 25% estrés, 1 crítica, NDVI medio ~0.52
const SOCIOS: SocioSeed[] = [
  {
    googleId: 'demo-reg-socio-1',
    email: 'socio1@regantes-demo.es',
    name: 'José Ramón Pérez García',
    phone: '+34 600 200 001',
    parcels: [
      {
        name: 'Cítricos Vega Baja · Orihuela',
        cropType: 'citrico', province: 'Alicante',
        sigpacRef: { prov: '03', muni: '99', agre: '0', zona: '0', poligono: '3', parcela: '10', recinto: '1' },
        ndviHistory: [
          { date: '2026-04-15', mean: 0.58, min: 0.42, max: 0.71, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.61, min: 0.46, max: 0.74, anomalyDetected: false },
          { date: '2026-05-05', mean: 0.64, min: 0.49, max: 0.76, anomalyDetected: false },
          { date: '2026-05-15', mean: 0.66, min: 0.51, max: 0.78, anomalyDetected: false },
          { date: '2026-05-25', mean: 0.65, min: 0.50, max: 0.77, anomalyDetected: false },
        ],
      },
      {
        name: 'Cítricos Vega Baja · Orihuela II',
        cropType: 'citrico', province: 'Alicante',
        sigpacRef: { prov: '03', muni: '99', agre: '0', zona: '0', poligono: '4', parcela: '5', recinto: '1' },
        ndviHistory: [
          { date: '2026-04-15', mean: 0.60, min: 0.45, max: 0.73, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.62, min: 0.47, max: 0.75, anomalyDetected: false },
          { date: '2026-05-05', mean: 0.64, min: 0.49, max: 0.76, anomalyDetected: false },
          { date: '2026-05-15', mean: 0.65, min: 0.50, max: 0.77, anomalyDetected: false },
          { date: '2026-05-25', mean: 0.66, min: 0.51, max: 0.78, anomalyDetected: false },
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
        name: 'Hortícola · Callosa de Segura',
        cropType: 'hortaliza', province: 'Alicante',
        sigpacRef: { prov: '03', muni: '49', agre: '0', zona: '0', poligono: '4', parcela: '1', recinto: '1' },
        ndviHistory: [
          { date: '2026-04-15', mean: 0.52, min: 0.38, max: 0.66, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.55, min: 0.40, max: 0.68, anomalyDetected: false },
          { date: '2026-05-05', mean: 0.58, min: 0.43, max: 0.70, anomalyDetected: false },
          { date: '2026-05-15', mean: 0.56, min: 0.41, max: 0.69, anomalyDetected: false },
          { date: '2026-05-25', mean: 0.59, min: 0.44, max: 0.71, anomalyDetected: false },
        ],
      },
      {
        // SOCIO 2 · PARCELA EN ESTRÉS · frutal con NDVI descendente
        name: 'Frutal · Callosa de Segura',
        cropType: 'frutal', province: 'Alicante',
        sigpacRef: { prov: '03', muni: '49', agre: '0', zona: '0', poligono: '4', parcela: '10', recinto: '1' },
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
        name: 'Cítricos · Almoradí',
        cropType: 'citrico', province: 'Alicante',
        sigpacRef: { prov: '03', muni: '70', agre: '0', zona: '0', poligono: '3', parcela: '1', recinto: '1' },
        ndviHistory: [
          { date: '2026-04-15', mean: 0.48, min: 0.34, max: 0.62, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.51, min: 0.36, max: 0.65, anomalyDetected: false },
          { date: '2026-05-05', mean: 0.47, min: 0.33, max: 0.61, anomalyDetected: false },
          { date: '2026-05-15', mean: 0.45, min: 0.31, max: 0.59, anomalyDetected: false },
          { date: '2026-05-25', mean: 0.43, min: 0.29, max: 0.57, anomalyDetected: false },
        ],
      },
      {
        // SOCIO 3 · PARCELA CRÍTICA · NDVI<0.30 → necesita riego YA
        name: 'Frutal · Orihuela',
        cropType: 'frutal', province: 'Alicante',
        sigpacRef: { prov: '03', muni: '99', agre: '0', zona: '0', poligono: '3', parcela: '30', recinto: '1' },
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
        name: 'Cítricos Vega Baja · Orihuela III',
        cropType: 'citrico', province: 'Alicante',
        sigpacRef: { prov: '03', muni: '99', agre: '0', zona: '0', poligono: '4', parcela: '1', recinto: '1' },
        ndviHistory: [
          { date: '2026-04-15', mean: 0.57, min: 0.42, max: 0.70, anomalyDetected: false },
          { date: '2026-04-25', mean: 0.60, min: 0.45, max: 0.72, anomalyDetected: false },
          { date: '2026-05-05', mean: 0.63, min: 0.48, max: 0.75, anomalyDetected: false },
          { date: '2026-05-15', mean: 0.65, min: 0.50, max: 0.77, anomalyDetected: false },
          { date: '2026-05-25', mean: 0.64, min: 0.49, max: 0.76, anomalyDetected: false },
        ],
      },
      {
        name: 'Cítricos Vega Baja · Orihuela IV',
        cropType: 'citrico', province: 'Alicante',
        sigpacRef: { prov: '03', muni: '99', agre: '0', zona: '0', poligono: '3', parcela: '7', recinto: '1' },
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

async function seed() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for regantes socios seed (v3 SIGPAC real)');

  // 1) UPSERT de la Comunidad de Regantes demo.
  await User.updateOne(
    { googleId: REGANTES_GOOGLE_ID },
    {
      $set: {
        email: 'comunidad@regantes-demo.es',
        name: 'Comunidad de Regantes Demo · Vega Baja del Segura',
        role: 'regantes',
        company: 'Comunidad de Regantes Demo (sintética, geometrías SIGPAC reales)',
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
  let sigpacFailures = 0;
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
      const ref = p.sigpacRef;
      const sigpacRefStr = `${ref.prov}/${ref.muni}/${ref.agre}/${ref.zona}/${ref.poligono}/${ref.parcela}/${ref.recinto}`;

      // Descargar geometría real catastral desde SIGPAC. Si falla
      // (404 / API caída), saltamos y re-run del seed la recupera.
      let sigpacResult: Awaited<ReturnType<typeof fetchByReference>>;
      try {
        sigpacResult = await fetchByReference(
          ref.prov, ref.muni, ref.agre, ref.zona, ref.poligono, ref.parcela, ref.recinto,
        );
      } catch (err) {
        sigpacFailures += 1;
        logger.warn(
          { parcelName: p.name, sigpacRef: sigpacRefStr, err: (err as Error).message },
          'sigpac_fetch_failed_skipping_parcel',
        );
        continue;
      }
      logger.info(
        { parcelName: p.name, sigpacRef: sigpacRefStr, areaHa: sigpacResult.areaHa, cropUse: sigpacResult.cropUse },
        'sigpac_fetched',
      );

      const ndviHistory = p.ndviHistory.map((r) => ({
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
            geometry: sigpacResult.geometry, // Polígono catastral REAL
            areaHa: sigpacResult.areaHa, // Superficie catastral REAL
            cropType: p.cropType,
            province: p.province,
            sigpacRef: sigpacRefStr, // Trazable al visor oficial
            isActive: true,
            isSyntheticDemo: true, // pipeline V2 lo ignora
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

  // Limpieza · borrar parcelas viejas v1 (polígonos sintéticos cuadrados)
  // que ya no están en SOCIOS pero existen en BD con nombres v1
  // ("Cítricos Vega Baja", "Hortícola El Soto", etc sin sufijo municipio).
  const v1Names = [
    'Cítricos Vega Baja',
    'Hortícola El Soto',
    'Cítricos La Alquería',
    'Frutal de Hueso Sur',
    'Hortícola Las Norias',
    'Cítricos El Palmeral',
    'Frutal La Cañada',
    'Cítricos El Calar',
  ];
  const socioIds = await User.find({ cooperativeId: comunidad._id }, { _id: 1 }).lean();
  const v1Removed = await Parcel.deleteMany({
    ownerId: { $in: socioIds.map((s) => s._id) },
    name: { $in: v1Names },
  });
  if (v1Removed.deletedCount > 0) {
    logger.info({ removed: v1Removed.deletedCount }, 'Removed v1 synthetic parcels');
  }

  const totalSocios = await User.countDocuments({ cooperativeId: comunidad._id });
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
      sigpacFailures,
    },
    'Regantes socios seed v3 complete',
  );

  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error({ err }, 'Regantes socios seed failed');
  process.exit(1);
});
