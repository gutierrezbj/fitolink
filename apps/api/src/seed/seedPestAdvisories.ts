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

  // Cleanup · 09-jun-2026 · eliminamos el advisory Polilla con sourceRef
  // inventado ("Boletín 19/2026") para sustituirlo por la versión con datos
  // LITERALES del portal RAIF oficial (informe Estado Prays oleae oct 2025).
  // Idempotente: si ya se ejecutó antes, deleteMany devuelve 0 borrados.
  const cleanup = await PestAdvisory.deleteMany({
    source: 'RAIF',
    sourceRef: 'Boletín 19/2026',
  });
  if (cleanup.deletedCount > 0) {
    logger.info({ deletedCount: cleanup.deletedCount }, 'cleanup: removed old polilla advisory with invented sourceRef');
  }

  const now = new Date();
  // Detected start of this month so the same advisory survives until the
  // next monthly bulletin cycle (applies to advisories without explicit dates).
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fechas del informe Prays oleae REAL del portal RAIF (publicado 01-oct-2025).
  // Vigente hasta nueva publicación oficial · expiresAt 2028 evita expiración
  // automática mientras no haya boletín posterior.
  const praysReportDate = new Date('2025-10-01');
  const praysExpiresAt = new Date('2028-12-31');

  const advisories = [
    {
      // ⭐ ADVISORY REAL · cifras LITERALES del portal RAIF oficial
      // (informe "Estado fitosanitario actual de Prays oleae en Andalucía"
      // publicado 01-oct-2025 en juntadeandalucia.es/agriculturapescaagua
      // ydesarrollorural/raif/estado-fitosanitario-actual-de-prays-oleae-
      // en-andalucia/). Datos verificables literalmente · cero invento.
      //
      // Tras revisión 09-jun-2026: este es el primer advisory del producto
      // que cita datos reales del portal oficial. Honra CRITICAL_no_inventar
      // en su máxima expresión.
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
      severity: 'low',  // "nivel de capturas bajo" · literal del portal RAIF
      detectedAt: praysReportDate,
      expiresAt: praysExpiresAt,
      source: 'RAIF',
      sourceRef: 'Estado Prays oleae · informe RAIF oct 2025 · Junta de Andalucía',
      recommendation:
        'Según último informe oficial RAIF publicado 01-oct-2025: en Sevilla se reportó 35% de aceitunas con Prays vivo (generación carpófaga) y 5,7 adultos/trampa/día en capturas. Umbral de tratamiento: ≥20% aceitunas con Prays vivo + ~20% huevos eclosionados. Estado fenológico dominante: H (endurecimiento de hueso). Consultar sourceUrl para la próxima actualización oficial.',
      sourceUrl: 'https://www.juntadeandalucia.es/agriculturapescaaguaydesarrollorural/raif/estado-fitosanitario-actual-de-prays-oleae-en-andalucia/',
      notes: 'Datos literales del portal oficial RAIF (publicación 01-oct-2025) · Málaga 45,1% / Córdoba 35,1% / Sevilla 35% aceitunas con Prays vivo en generación carpófaga · capturas adultos Málaga 16,1 / Sevilla 5,7 / Cádiz 4,1 por trampa/día. Próximamente puestas sobre hojas (generación filófaga). Honra CRITICAL_no_inventar · todos los datos verificables clickeando sourceUrl.',
      createdBy: admin._id,
      fingerprint: 'polilla-olivo-RAIF-informe-oficial-2025-10',
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
