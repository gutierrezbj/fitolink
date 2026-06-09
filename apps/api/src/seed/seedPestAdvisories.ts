/**
 * Seed: 2 phytosanitary advisories so the PestAdvisoriesCard widget has
 * data to show in the parcel detail pages without waiting for the
 * agronomist to enter the first real bulletin.
 *
 * Idempotent: each advisory is keyed by a deterministic fingerprint
 * (pest + source + sourceRef + detected month). Re-running this script
 * will skip rows that already exist instead of failing.
 *
 * Run via:
 *   docker compose exec -T api node apps/api/dist/seed/seedPestAdvisories.js
 */
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { PestAdvisory } from '../models/PestAdvisory.js';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for pest advisory seed');

  // Use the demo admin as creator
  const admin = await User.findOne({ googleId: 'demo-admin-001' });
  if (!admin) {
    logger.error('demo-admin-001 not found — run the main seed first');
    await mongoose.disconnect();
    process.exit(1);
  }

  const now = new Date();
  // Detected start of this month so the same advisory survives until the
  // next monthly bulletin cycle.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const advisories = [
    {
      pestName: 'Prays oleae · polilla del olivo',
      scientificName: 'Prays oleae',
      cropTypes: ['olivo'],
      affectedAreas: [
        {
          province: 'Sevilla',
          comarca: 'Estepa / Sierra Sur',
          centroid: { type: 'Point' as const, coordinates: [-4.873, 37.291] },
          radiusKm: 35,
        },
      ],
      severity: 'medium',
      detectedAt: monthStart,
      source: 'RAIF',
      sourceRef: 'Boletín 19/2026',
      recommendation: 'Considere tratamiento preventivo en la próxima ventana drone favorable. Floración en curso eleva la sensibilidad.',
      sourceUrl: 'https://www.juntadeandalucia.es/agriculturaypesca/raif/',
      notes: 'Generación filófaga finalizando. Inicio de generación carpófaga prevista en 2-3 semanas.',
      createdBy: admin._id,
      fingerprint: `polilla-olivo-RAIF-19-2026-${monthStart.toISOString().slice(0, 7)}`,
      isActive: true,
    },
    {
      pestName: 'Bactrocera oleae · mosca del olivo',
      scientificName: 'Bactrocera oleae',
      cropTypes: ['olivo'],
      affectedAreas: [
        {
          // Jaén capital area
          province: 'Jaen',
          comarca: 'La Loma',
          centroid: { type: 'Point' as const, coordinates: [-3.79, 37.77] },
          radiusKm: 40,
        },
        {
          // Córdoba sub-bético
          province: 'Cordoba',
          comarca: 'Subbética',
          centroid: { type: 'Point' as const, coordinates: [-4.42, 37.50] },
          radiusKm: 30,
        },
      ],
      severity: 'low',
      detectedAt: monthStart,
      source: 'RAIF',
      sourceRef: 'Boletín 18/2026',
      recommendation: 'Capturas todavía bajas. Mantener monitoreo, no es necesario actuar todavía.',
      sourceUrl: 'https://www.juntadeandalucia.es/agriculturaypesca/raif/',
      createdBy: admin._id,
      fingerprint: `mosca-olivo-RAIF-18-2026-${monthStart.toISOString().slice(0, 7)}`,
      isActive: true,
    },
    {
      // Repilo del olivo · enfermedad fúngica clásica del olivar
      // mediterráneo (anamorfo del ascomicete Venturia oleaginea).
      // Causa defoliación temprana y reducción de producción · plaga real
      // bien documentada en boletines RAIF zona olivarera Jaén. Centroid
      // Loma de Úbeda (zona olivarera principal de Jaén) con radio 60km
      // para cubrir Sierra Sur de Sevilla también (Aula Jaén + Coop Estepa).
      pestName: 'Spilocaea oleagina · repilo del olivo',
      scientificName: 'Spilocaea oleagina (Venturia oleaginea)',
      cropTypes: ['olivo'],
      affectedAreas: [
        {
          province: 'Jaen',
          comarca: 'Loma de Úbeda',
          centroid: { type: 'Point' as const, coordinates: [-3.50, 37.95] },
          radiusKm: 60,
        },
      ],
      severity: 'medium',
      detectedAt: monthStart,
      source: 'RAIF',
      sourceRef: 'Boletín 20/2026',
      recommendation: 'Vigilar manchas circulares oscuras en haz de hojas y defoliación basal. Condiciones favorables al hongo · humedad alta + T 10-25°C. Tratamientos cúpricos preventivos en ventanas secas.',
      sourceUrl: 'https://www.juntadeandalucia.es/agriculturaypesca/raif/',
      notes: 'Enfermedad endémica del olivar · más activa en primavera/otoño · primavera tardía sigue siendo ventana de monitoreo.',
      createdBy: admin._id,
      fingerprint: `repilo-olivo-RAIF-20-2026-${monthStart.toISOString().slice(0, 7)}`,
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

  logger.info({ inserted, skipped }, 'Pest advisory seed complete');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'Pest advisory seed failed');
  process.exit(1);
});
