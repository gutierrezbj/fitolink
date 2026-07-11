/**
 * Seed · Advisory ITACYL (Castilla y León) · Bloque C · 5ª fuente oficial.
 *
 * Primer advisory de ITACYL (Instituto Tecnológico Agrario de Castilla y
 * León · portal plagas.itacyl.es), reenviado por John el 11-jun-2026.
 * Boletín oficial REAL del 9-jun-2026.
 *
 * Plaga: Escarabajo de la patata (Leptinotarsa decemlineata) en patata.
 * Datos LITERALES del boletín "Información para agricultores" (9 jun 2026)
 * del Observatorio de plagas y enfermedades agrícolas de CyL + OIPACYL
 * (Interprofesional de la Patata) + FMC Agricultural Solutions:
 *   "detección de escarabajo de la patata en parcelas de patata, incluyendo
 *    casos próximos a los niveles de umbral de tratamiento."
 *
 * Honra CRITICAL_no_inventar: plaga real, fecha real, fuente real, sin cifras
 * inventadas. El boletín es REGIONAL (toda CyL), no de una comarca puntual →
 * el affectedArea usa el corazón de la zona patatera (vegas del Duero-Pisuerga
 * / Tierra de Campos) con radio amplio, y `notes` lo deja explícito.
 *
 * Ejecutar:
 *   docker compose exec -T api node apps/api/dist/seed/seedPestAdvisoryITACYL.js
 */
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { PestAdvisory } from '../models/PestAdvisory.js';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

const ITACYL_FICHA = 'https://plagas.itacyl.es/escarabajo-de-la-patata';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for ITACYL pest advisory seed');

  const admin = await User.findOne({ googleId: 'demo-admin-001' });
  if (!admin) {
    logger.error('demo-admin-001 not found — run the main seed first');
    await mongoose.disconnect();
    process.exit(1);
  }

  const advisory = {
    pestName: 'Leptinotarsa decemlineata · escarabajo de la patata',
    scientificName: 'Leptinotarsa decemlineata',
    cropTypes: ['patata'],
    affectedAreas: [
      {
        // Boletín REGIONAL de Castilla y León (no comarca puntual). Centroide
        // en el corazón de la zona patatera (Valladolid · vegas Duero-Pisuerga),
        // radio 120 km cubre Valladolid, Palencia, Segovia, Zamora, sur de León.
        province: 'Valladolid',
        comarca: 'Castilla y León · zona patatera (vegas del Duero-Pisuerga / Tierra de Campos)',
        centroid: { type: 'Point' as const, coordinates: [-4.72, 41.65] },
        radiusKm: 120,
      },
    ],
    severity: 'medium' as const,   // "casos próximos a los niveles de umbral" · vigilancia, umbral no superado de forma generalizada
    detectedAt: new Date('2026-06-09'),
    // Vigente hasta nueva publicación del observatorio. expiresAt EXPLÍCITO:
    // sin él, el default del modelo (now + 21 días) lo mata en silencio y el
    // aviso desaparece del tablón sin que nadie se entere (fix 11-jul-2026 ·
    // mismo patrón que RAIF). La frescura honesta la da detectedAt visible
    // en la card, no este campo.
    expiresAt: new Date('2028-12-31'),
    source: 'ITACYL' as const,
    sourceRef: 'Información para agricultores · Observatorio de plagas y enfermedades agrícolas de CyL · 9 jun 2026',
    recommendation:
      'Vigilancia de las parcelas de patata y consultar la ficha de apoyo técnico emitida al efecto. Tratar únicamente al alcanzar el umbral definido, con productos autorizados en el Registro Oficial del MAPA. Consulte el boletín semanal completo en sourceUrl.',
    sourceUrl: ITACYL_FICHA,
    notes:
      'Boletín oficial 9-jun-2026 (Observatorio de plagas CyL + OIPACYL + FMC). Detección de escarabajo de la patata en parcelas, con casos PRÓXIMOS a los niveles de umbral de tratamiento mientras los condicionantes sigan favorables. Aviso REGIONAL de Castilla y León — no de una parcela puntual. El portal ITACYL actualiza el boletín semanalmente. El propio boletín recuerda que "lo que pueda observarse en una parcela es sólo atribuible a ella misma": el agricultor debe cotejar el estado en cada parcela antes de decidir.',
    createdBy: admin._id,
    fingerprint: 'escarabajo-patata-ITACYL-2026-06-09',
    isActive: true,
  };

  // Reinsert limpio: si una ejecución manual anterior dejó este aviso con el
  // expiresAt por defecto del modelo (21 días, ya vencido), $setOnInsert NO
  // lo revive — borramos por fingerprint y el upsert lo reinserta con la
  // vigencia explícita. Idempotente (fix 11-jul-2026).
  await PestAdvisory.deleteMany({ fingerprint: advisory.fingerprint });

  const result = await PestAdvisory.updateOne(
    { fingerprint: advisory.fingerprint },
    { $setOnInsert: advisory },
    { upsert: true },
  );

  logger.info(
    { inserted: result.upsertedCount, source: 'ITACYL', pest: 'escarabajo de la patata' },
    'ITACYL advisory seed complete',
  );
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'ITACYL advisory seed failed');
  process.exit(1);
});
