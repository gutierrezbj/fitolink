/**
 * Seed · Advisories Levante (SAIF Valencia + SIAM Murcia) · Bloque C.
 *
 * 2 advisories vivos para zonas cítricas Vega Baja del Segura · zona que
 * cruza administrativamente provincia Alicante (Comunitat Valenciana ·
 * fuente IVIA / SAIF) y provincia Murcia (Región de Murcia · fuente
 * IMIDA / SIAM). Las parcelas demo `demo-regantes-001` Comunidad de
 * Regantes Vega Baja del Segura están casi todas en Alicante (Almoradí,
 * Orihuela, Callosa de Segura).
 *
 * Plagas verificables en boletines oficiales recientes:
 *  - Delottococcus aberiae (cotonet africano) · plaga emergente cítricos
 *    Levante española documentada desde ~2009 · daño grave a fruto ·
 *    IVIA mantiene monitoreo continuo + trampas feromona.
 *  - Phyllocnistis citrella (minador de las hojas) · plaga clásica de
 *    cítricos · ataca brotes tiernos · presente en toda España citrícola
 *    desde los años 90 · monitoreo activo IVIA + IMIDA.
 *
 * Honra CRITICAL_no_inventar · plagas reales bien documentadas ·
 * severity 'medium' neutral · sourceUrl al portal oficial donde el
 * agricultor verifica · fingerprint estable sin mes (fix 11-jul-2026).
 *
 * Ejecutar:
 *   docker compose exec -T api node apps/api/dist/seed/seedPestAdvisoriesLevante.js
 */
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { PestAdvisory } from '../models/PestAdvisory.js';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

// Fix 12-jul-2026: la raíz de agroambient.gva.es dejaba al agricultor en la
// home de la Conselleria sin poder encontrar el aviso del cotonet ("no
// encuentro la anexa"). La ficha REAL y VIVA (HTTP 200, cita Delottococcus
// aberiae) vive en el portal GIP Cítricos del IVIA. (gvasanitatvegetal.gva.es
// sigue muerto y las rutas profundas de agroambient redirigen a un dominio
// interno roto webinterna2.gva.es — verificado.)
const IVIA_COTONET = 'http://gipcitricos.ivia.es/area/plagas-principales/pseudococcidos'; // IVIA · ficha Cotonet (Delottococcus aberiae)
const IMIDA_PORTAL = 'https://www.imida.es/';        // IMIDA Murcia (portal del organismo · siam.imida.es está caído)

async function seed() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for Levante pest advisory seed');

  const admin = await User.findOne({ googleId: 'demo-admin-001' });
  if (!admin) {
    logger.error('demo-admin-001 not found — run the main seed first');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Fix 11-jul-2026 · honestidad de fechas + vigencia (mismo patrón que DARP):
  //  - detectedAt = fecha REAL de curación contra los portales (09-jun-2026),
  //    NO monthStart del momento del re-seed (aparentaba frescura falsa).
  //  - expiresAt explícito: el default del modelo (now + 21 días) mataba
  //    estos avisos en silencio — así desaparecieron SAIF/SIAM del tablón.
  //  - fingerprint estable sin mes: un aviso = una fila, no una copia por mes.
  const curatedAt = new Date('2026-06-09');
  const vigenteHastaNuevaPublicacion = new Date('2028-12-31');

  // Reinsert limpio: borra tanto las copias mensuales antiguas (sufijo
  // -YYYY-MM, caducadas por el default de 21 días) como la fila estable
  // actual, para que el upsert SIEMPRE converja al contenido de este seed
  // ($setOnInsert no actualiza filas existentes). Idempotente.
  const cleanup = await PestAdvisory.deleteMany({
    fingerprint: { $regex: /^(cotonet-SAIF-VegaBaja|minador-SIAM-VegaSegura)(-\d{4}-\d{2})?$/ },
  });
  if (cleanup.deletedCount > 0) {
    logger.info({ deletedCount: cleanup.deletedCount }, 'cleanup: removed stale Levante advisories for clean reinsert');
  }

  const advisories = [
    {
      // Cotonet africano · Delottococcus aberiae · plaga emergente
      // grave cítricos Levante española documentada IVIA desde ~2009.
      // Causa caída de fruto y deformación · campaña 2024-2026 con
      // expansión activa en Vega Baja del Segura. Centroid Almoradí
      // (Alicante) con radio 40km cubre todo Vega Baja (Orihuela 7km
      // norte, Callosa Segura 8km, Murcia ciudad 30km).
      pestName: 'Delottococcus aberiae · cotonet africano',
      scientificName: 'Delottococcus aberiae',
      cropTypes: ['citrico'],
      affectedAreas: [
        {
          province: 'Alicante',
          comarca: 'Vega Baja del Segura',
          centroid: { type: 'Point' as const, coordinates: [-0.78, 38.10] },
          radiusKm: 40,
        },
      ],
      severity: 'high',
      detectedAt: curatedAt,
      expiresAt: vigenteHastaNuevaPublicacion,
      source: 'SAIF',
      sourceRef: 'IVIA · GIP Cítricos · ficha Cotonet (Delottococcus aberiae)',
      recommendation:
        'Vigilancia activa con trampas feromona en perímetro de parcela. Tratamientos coordinados con la cooperativa o ADV citrícola (el aislamiento entre parcelas vecinas reduce eficacia). Productos autorizados aplicación cítricos · consultar la ficha oficial del IVIA en sourceUrl.',
      sourceUrl: IVIA_COTONET,
      notes: 'Plaga emergente · daño directo a fruto (caída y deformación) · monitoreo continuo IVIA Comunitat Valenciana desde 2009. Tratamiento aislado por agricultor poco eficaz · requiere coordinación comarcal.',
      createdBy: admin._id,
      fingerprint: 'cotonet-SAIF-VegaBaja',
      isActive: true,
    },
    {
      // Minador de las hojas · Phyllocnistis citrella · plaga clásica
      // cítricos · ataca brotes tiernos primavera-verano · monitoreo
      // activo IMIDA Murcia + IVIA Valencia. Centroid Murcia ciudad
      // [-1.13, 37.99] con radio 50km cubre cítricos Murcia + Vega Baja
      // Alicante (Almoradí ~30km, Orihuela ~35km).
      pestName: 'Phyllocnistis citrella · minador de las hojas',
      scientificName: 'Phyllocnistis citrella',
      cropTypes: ['citrico'],
      affectedAreas: [
        {
          province: 'Murcia',
          comarca: 'Huerta de Murcia / Vega del Segura',
          centroid: { type: 'Point' as const, coordinates: [-1.13, 37.99] },
          radiusKm: 50,
        },
      ],
      severity: 'medium',
      detectedAt: curatedAt,
      expiresAt: vigenteHastaNuevaPublicacion,
      source: 'SIAM',
      sourceRef: 'Vigilancia SIAM / IMIDA Sanidad Vegetal · Vega del Segura',
      recommendation:
        'Vigilar brotes nuevos · daño visible en hojas como galerías serpenteantes. Tratamiento solo justificado en plantaciones jóvenes (<5 años) o con elevada brotación. Adultos manejados con la coordinación habitual de la cooperativa · consultar IMIDA en sourceUrl.',
      sourceUrl: IMIDA_PORTAL,
      notes: 'Plaga clásica presente en toda España citrícola desde los años 90 · daño económico relevante solo en plantaciones jóvenes con mucha brotación · plantaciones maduras toleran sin pérdida significativa.',
      createdBy: admin._id,
      fingerprint: 'minador-SIAM-VegaSegura',
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

  logger.info({ inserted, skipped, sources: ['SAIF', 'SIAM'] }, 'Levante advisory seed complete');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'Levante advisory seed failed');
  process.exit(1);
});
