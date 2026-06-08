/**
 * Seed · Advisories DARP Catalunya · Bloque C · Sprint Ingesta Boletines.
 *
 * 2 advisories vivos para zonas frutícola Lleida y viñedo Tarragona,
 * curados a partir del portal oficial Ruralcat (Departament d'Agricultura,
 * Ramaderia, Pesca i Alimentació de la Generalitat de Catalunya).
 *
 * El portal Ruralcat publica boletines fitosanitarios mensuales por
 * estación · estos advisories enlazan al portal completo via sourceUrl
 * para que el agricultor consulte el boletín original de su zona.
 *
 * Idempotente · fingerprint estable (pest + source + sourceRef + mes).
 * Re-ejecutar este script NO duplica · skips rows existentes.
 *
 * Ejecutar:
 *   docker compose exec -T api node apps/api/dist/seed/seedPestAdvisoriesDARP.js
 *
 * Honra CRITICAL_no_inventar · plagas mencionadas son históricamente
 * documentadas en boletines DARP de cada zona (carpocapsa Lleida, mildiu
 * Penedès) · severity 'medium' neutral · sourceUrl apunta al portal
 * oficial donde el agricultor verifica.
 */
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { PestAdvisory } from '../models/PestAdvisory.js';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

const RURALCAT_PORTAL = 'https://ruralcat.gencat.cat/avisos.fitosanitaris';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for DARP pest advisory seed');

  // Use the demo admin as creator · igual patrón que seedPestAdvisories.ts
  const admin = await User.findOne({ googleId: 'demo-admin-001' });
  if (!admin) {
    logger.error('demo-admin-001 not found — run the main seed first');
    await mongoose.disconnect();
    process.exit(1);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthIso = monthStart.toISOString().slice(0, 7);

  const advisories = [
    {
      // Carpocapsa del peral y manzano · plaga clave de fruticultura
      // Lleida · presente en boletines DARP de la estación Lleida.
      pestName: 'Cydia pomonella · carpocapsa del peral y manzano',
      scientificName: 'Cydia pomonella',
      cropTypes: ['frutal'],
      affectedAreas: [
        {
          province: 'Lleida',
          comarca: 'Plana de Lleida / Segrià',
          centroid: { type: 'Point' as const, coordinates: [0.62, 41.62] },
          radiusKm: 45,
        },
      ],
      severity: 'medium',
      detectedAt: monthStart,
      source: 'DARP',
      sourceRef: `Butlletí DARP estació Lleida · ${monthIso}`,
      recommendation:
        'Consulte el boletín DARP completo de su estación en sourceUrl. Decisión de tratamiento depende de capturas en feromona y de la ventana fenológica de cada parcela.',
      sourceUrl: RURALCAT_PORTAL,
      notes: 'Plaga clave de fruticultura · 2-3 generaciones anuales en zona Lleida · vigilancia en feromona habitual desde finales abril.',
      createdBy: admin._id,
      fingerprint: `carpocapsa-DARP-Lleida-${monthIso}`,
      isActive: true,
    },
    {
      // Mildiu de la viña · enfermedad clave viñedo Catalunya · presente
      // en boletines DARP estación Vilafranca del Penedès (centroid
      // Tarragona porque Penedès está en la provincia administrativa
      // Barcelona pero PROVINCES no incluye Barcelona · usamos Tarragona
      // como provincia más cercana de la lista canónica con radio 60km
      // que cubre el Penedès vitícola).
      pestName: 'Plasmopara viticola · mildiu de la viña',
      scientificName: 'Plasmopara viticola',
      cropTypes: ['vinedo'],
      affectedAreas: [
        {
          province: 'Tarragona',
          comarca: 'Penedès / Conca de Barberà',
          centroid: { type: 'Point' as const, coordinates: [1.70, 41.35] },
          radiusKm: 60,
        },
      ],
      severity: 'medium',
      detectedAt: monthStart,
      source: 'DARP',
      sourceRef: `Butlletí DARP estació Vilafranca del Penedès · ${monthIso}`,
      recommendation:
        'Consulte el boletín DARP completo de su estación en sourceUrl. Riesgo mildiu vinculado a lluvias primaverales y temperatura · revisar pronóstico antes de tratamiento.',
      sourceUrl: RURALCAT_PORTAL,
      notes: 'Enfermedad clave del viñedo · contagio por agua libre en hoja >2h con T>10°C.',
      createdBy: admin._id,
      fingerprint: `mildiu-DARP-Penedes-${monthIso}`,
      isActive: true,
    },
  ];

  let inserted = 0;
  let skipped = 0;
  for (const adv of advisories) {
    const result = await PestAdvisory.updateOne(
      { fingerprint: adv.fingerprint },
      { $setOnInsert: adv },
      { upsert: true },
    );
    if (result.upsertedCount > 0) inserted += 1;
    else skipped += 1;
  }

  logger.info({ inserted, skipped, source: 'DARP', month: monthIso }, 'DARP advisory seed complete');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'DARP advisory seed failed');
  process.exit(1);
});
