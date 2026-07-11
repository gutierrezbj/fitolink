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
 * Idempotente · fingerprint estable (pest + source + zona, sin mes desde
 * el fix 11-jul-2026). Re-ejecutar este script NO duplica · skips rows
 * existentes.
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

  // Fix 11-jul-2026 · honestidad de fechas + vigencia:
  //  - detectedAt = fecha REAL de curación contra el portal (08-jun-2026, ver
  //    verificación tabla oficial en el comentario del mildiu), NO monthStart
  //    del momento del re-seed (aparentaba frescura que no existe).
  //  - expiresAt explícito: sin él, el default del modelo (now + 21 días)
  //    mataba estos avisos en silencio — así desapareció DARP del tablón.
  //  - fingerprint estable sin mes: un aviso = una fila, no una copia por mes.
  const curatedAt = new Date('2026-06-08');
  const vigenteHastaNuevaPublicacion = new Date('2028-12-31');

  // Reinsert limpio: borra tanto las copias mensuales antiguas (sufijo
  // -YYYY-MM, ya caducadas por el default de 21 días) como la fila estable
  // actual, para que el upsert posterior SIEMPRE converja al contenido de
  // este seed ($setOnInsert no actualiza filas existentes). Incluye el
  // fingerprint histórico mildiu-DARP-Penedes-* (versión previa del aviso
  // antes del ajuste de comarca a Tarragona). Idempotente.
  const cleanup = await PestAdvisory.deleteMany({
    fingerprint: { $regex: /^(carpocapsa-DARP-Lleida|mildiu-DARP-Tarragona|mildiu-DARP-Penedes)(-\d{4}-\d{2})?$/ },
  });
  if (cleanup.deletedCount > 0) {
    logger.info({ deletedCount: cleanup.deletedCount }, 'cleanup: removed stale DARP advisories for clean reinsert');
  }

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
      detectedAt: curatedAt,
      expiresAt: vigenteHastaNuevaPublicacion,
      source: 'DARP',
      sourceRef: "Portal d'avisos fitosanitaris Ruralcat (DARP) · estació Lleida",
      recommendation:
        'Consulte el boletín DARP completo de su estación en sourceUrl. Decisión de tratamiento depende de capturas en feromona y de la ventana fenológica de cada parcela.',
      sourceUrl: RURALCAT_PORTAL,
      notes: 'Plaga clave de fruticultura · 2-3 generaciones anuales en zona Lleida · vigilancia en feromona habitual desde finales abril.',
      createdBy: admin._id,
      fingerprint: 'carpocapsa-DARP-Lleida',
      isActive: true,
    },
    {
      // Mildiu de la viña · enfermedad clave del viñedo en Conca de Barberà
      // y Priorat. Verificado contra la tabla oficial del Servei de Sanitat
      // Vegetal (foto 08-jun-2026): EA Tarragona cubre `vinya` en comarcas
      // `Tarragonès, Alt Camp, Baix Camp, Conca de Barberà i Priorat` ·
      // todas en provincia administrativa Tarragona (province field
      // 100% honesto). Centroid en Falset (Priorat) ~[0.83, 41.14] ·
      // radio 50km cubre las 5 comarcas vitícolas Tarragona.
      pestName: 'Plasmopara viticola · mildiu de la viña',
      scientificName: 'Plasmopara viticola',
      cropTypes: ['vinedo'],
      affectedAreas: [
        {
          province: 'Tarragona',
          comarca: 'Priorat / Conca de Barberà / Tarragonès',
          centroid: { type: 'Point' as const, coordinates: [0.83, 41.14] },
          radiusKm: 50,
        },
      ],
      severity: 'medium',
      detectedAt: curatedAt,
      expiresAt: vigenteHastaNuevaPublicacion,
      source: 'DARP',
      sourceRef: "Portal d'avisos fitosanitaris Ruralcat (DARP) · EA Tarragona",
      recommendation:
        'Consulte el boletín DARP completo de su estación en sourceUrl. Riesgo mildiu vinculado a lluvias primaverales y temperatura · revisar pronóstico antes de tratamiento.',
      sourceUrl: RURALCAT_PORTAL,
      notes: 'Enfermedad clave del viñedo · contagio por agua libre en hoja >2h con T>10°C · DARP recomienda integrarse en ADV para asesoramiento individualizado.',
      createdBy: admin._id,
      fingerprint: 'mildiu-DARP-Tarragona',
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

  logger.info({ inserted, skipped, source: 'DARP' }, 'DARP advisory seed complete');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'DARP advisory seed failed');
  process.exit(1);
});
