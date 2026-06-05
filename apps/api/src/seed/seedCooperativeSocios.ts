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

interface ParcelSeed {
  name: string;
  cropType: string;
  province: string;
  sigpacRef: SigpacRef;
}

interface SocioSeed {
  googleId: string;
  email: string;
  name: string;
  phone?: string;
  parcels: ParcelSeed[];
}

const COOP_GOOGLE_ID = 'demo-cooperative-001';

// v2 · 05-jun-2026 · SIGPAC catastral REAL en Estepa/Sierra Sur (Sevilla,
// provincia 41). Sustituye los cuadrados sintéticos ringFromCentroid de
// v1 que JuanCho vio en demo y dijo "otro cuadrado y a patadas nos sacan".
// Mismo patrón que Aula Jaén v2 (commit f4cc352) y Regantes v3 (691b864).
//
// 10 referencias SIGPAC OV (olivar) sondeadas manualmente 05-jun-2026,
// todas en municipios DOP Estepa:
//
//   Casariche (muni 26) · core DOP Estepa:
//     41/26/0/0/4/1/1   · 6.46 ha
//     41/26/0/0/4/10/1  · 8.70 ha
//
//   Marinaleda (muni 61):
//     41/61/0/0/1/1/1   · 9.10 ha
//     41/61/0/0/6/20/1  · 8.56 ha
//     41/61/0/0/1/10/1  · 4.72 ha
//     41/61/0/0/3/20/1  · 4.73 ha
//
//   El Rubio (muni 82):
//     41/82/0/0/1/1/1   · 11.35 ha
//     41/82/0/0/1/5/1   · 3.02 ha
//     41/82/0/0/4/1/1   · 12.73 ha
//
//   Herrera (muni 49):
//     41/49/0/0/4/20/1  · 14.93 ha
//
// Total: ~84 ha (vs 198 sintético inflado). Cualquier tecnico cooperativa
// puede pegar la ref en https://sigpac.mapa.gob.es/fega/visor/ y ver
// EXACTAMENTE el mismo polígono. Cero invento. Auditable.
const SOCIOS: SocioSeed[] = [
  {
    googleId: 'demo-coop-socio-1',
    email: 'socio1@dcoop-demo.coop',
    name: 'Manuel Reyes Aguilar',
    phone: '+34 600 100 001',
    parcels: [
      { name: 'Olivar Las Pedreras', cropType: 'olivo', province: 'Sevilla', sigpacRef: { prov: '41', muni: '26', agre: '0', zona: '0', poligono: '4', parcela: '1',  recinto: '1' } },
      { name: 'Olivar El Soto',      cropType: 'olivo', province: 'Sevilla', sigpacRef: { prov: '41', muni: '26', agre: '0', zona: '0', poligono: '4', parcela: '10', recinto: '1' } },
    ],
  },
  {
    googleId: 'demo-coop-socio-2',
    email: 'socio2@dcoop-demo.coop',
    name: 'Hermanos Ruiz Castro',
    phone: '+34 600 100 002',
    parcels: [
      { name: 'Olivar La Atalaya',       cropType: 'olivo', province: 'Sevilla', sigpacRef: { prov: '41', muni: '61', agre: '0', zona: '0', poligono: '1', parcela: '1',  recinto: '1' } },
      { name: 'Olivar Cerro del Aguila', cropType: 'olivo', province: 'Sevilla', sigpacRef: { prov: '41', muni: '61', agre: '0', zona: '0', poligono: '6', parcela: '20', recinto: '1' } },
    ],
  },
  {
    googleId: 'demo-coop-socio-3',
    email: 'socio3@dcoop-demo.coop',
    name: 'María José Vega Pérez',
    phone: '+34 600 100 003',
    parcels: [
      { name: 'Olivar Los Manantiales', cropType: 'olivo', province: 'Sevilla', sigpacRef: { prov: '41', muni: '61', agre: '0', zona: '0', poligono: '1', parcela: '10', recinto: '1' } },
      { name: 'Olivar Casa Bermeja',    cropType: 'olivo', province: 'Sevilla', sigpacRef: { prov: '41', muni: '61', agre: '0', zona: '0', poligono: '3', parcela: '20', recinto: '1' } },
    ],
  },
  {
    googleId: 'demo-coop-socio-4',
    email: 'socio4@dcoop-demo.coop',
    name: 'Juan Cabrera Lozano',
    phone: '+34 600 100 004',
    parcels: [
      { name: 'Olivar El Puerto',  cropType: 'olivo', province: 'Sevilla', sigpacRef: { prov: '41', muni: '82', agre: '0', zona: '0', poligono: '1', parcela: '1', recinto: '1' } },
      { name: 'Olivar La Veguilla', cropType: 'olivo', province: 'Sevilla', sigpacRef: { prov: '41', muni: '82', agre: '0', zona: '0', poligono: '1', parcela: '5', recinto: '1' } },
    ],
  },
  {
    googleId: 'demo-coop-socio-5',
    email: 'socio5@dcoop-demo.coop',
    name: 'Familia Domínguez Olivos',
    phone: '+34 600 100 005',
    parcels: [
      { name: 'Olivar Cortijo Nuevo', cropType: 'olivo', province: 'Sevilla', sigpacRef: { prov: '41', muni: '82', agre: '0', zona: '0', poligono: '4',  parcela: '1',  recinto: '1' } },
      { name: 'Olivar La Loma Alta',  cropType: 'olivo', province: 'Sevilla', sigpacRef: { prov: '41', muni: '49', agre: '0', zona: '0', poligono: '4',  parcela: '20', recinto: '1' } },
    ],
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for cooperative socios seed');

  // Upsert de la cooperativa demo (05-jun-2026). Antes este script fallaba
  // si demo-cooperative-001 no existía — pero seed.ts principal nunca crea
  // este usuario, y en prod hay datos reales que skip-ean seed.ts, así que
  // en prod la cooperativa NUNCA se creaba. Ahora upsert: si no existe lo
  // crea, si existe lo promueve a role 'cooperative'.
  await User.updateOne(
    { googleId: COOP_GOOGLE_ID },
    {
      $set: {
        email: 'cooperativa@dcoop-demo.coop',
        name: 'Cooperativa Demo · Olivar DOP Estepa',
        role: 'cooperative',
        company: 'DCOOP Demo (sintética)',
        isVerified: true,
        avatar: '/provider-cooperative.svg',
        updatedAt: new Date(),
      },
      $unset: { location: '' },
      $setOnInsert: { googleId: COOP_GOOGLE_ID, createdAt: new Date() },
    },
    { upsert: true },
  );
  const coop = await User.findOne({ googleId: COOP_GOOGLE_ID });
  if (!coop) {
    logger.error('Cooperative user demo-cooperative-001 upsert failed');
    await mongoose.disconnect();
    process.exit(1);
  }
  logger.info({ coopId: coop._id }, 'Cooperative user ready');

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
          cooperativeId: coop._id,
          isVerified: true,
          rating: 0,
          ratingCount: 0,
          avatar: '/farmer.svg',
          updatedAt: now,
        },
        // Strip the empty `location` subdoc Mongoose tries to default in.
        // Leaving `{coordinates: []}` blows up the 2dsphere index. The
        // cooperative socios don't have a base location anyway.
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
      // Importante: ndviHistory NO se incluye en $set · si la parcela
      // ya existía con history del pipeline V2, se preserva. Si es
      // nueva, queda vacía y el próximo paso del pipeline la llenará.
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
      sigpacFailures,
    },
    'Cooperative socios seed complete',
  );

  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error({ err }, 'Cooperative socios seed failed');
  process.exit(1);
});
