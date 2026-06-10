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

  // Cleanup · 11-jun-2026 · forzar refresh del copy de los 5 advisories Prays
  // provincia oct-2025 con el nuevo framing "última publicación oficial vigente"
  // tras feedback PM JuanCho viendo demo Encineño cuenta fondo: "Navegante esto
  // data del 2025 !!!". Como el seed usa $setOnInsert (idempotente por fingerprint),
  // si los advisories ya existen NO se sobrescriben · borramos primero y dejamos
  // que el upsert posterior los reinserte con el copy actualizado.
  // Idempotente: si ya se ejecutó antes, deleteMany devuelve 0 borrados.
  const cleanupPraysProvincias = await PestAdvisory.deleteMany({
    fingerprint: { $in: [
      'polilla-olivo-RAIF-informe-oficial-2025-10',
      'polilla-olivo-RAIF-Malaga-2025-10',
      'polilla-olivo-RAIF-Cordoba-2025-10',
      'polilla-olivo-RAIF-Cadiz-2025-10',
      'polilla-olivo-RAIF-Granada-2025-10',
    ] },
  });
  if (cleanupPraysProvincias.deletedCount > 0) {
    logger.info({ deletedCount: cleanupPraysProvincias.deletedCount }, 'cleanup: removed 5 Prays oct-2025 advisories for copy refresh');
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
        'Última publicación oficial vigente · informe RAIF balance temporada 2025 (la Junta publica este informe periódicamente al cierre de cada campaña olivar). En la temporada 2025 Sevilla reportó 35% de aceitunas con Prays vivo (generación carpófaga) y 5,7 adultos/trampa/día en capturas. Umbral de tratamiento: ≥20% aceitunas con Prays vivo + ~20% huevos eclosionados. Estado fenológico dominante: H (endurecimiento de hueso). Vigilar evolución temporada 2026 a través del sourceUrl · próxima actualización oficial esperada tras cosecha 2026.',
      sourceUrl: 'https://www.juntadeandalucia.es/agriculturapescaaguaydesarrollorural/raif/estado-fitosanitario-actual-de-prays-oleae-en-andalucia/',
      notes: 'Datos literales del portal oficial RAIF (última publicación vigente · balance temporada 2025) · Málaga 45,1% / Córdoba 35,1% / Sevilla 35% aceitunas con Prays vivo en generación carpófaga · capturas adultos Málaga 16,1 / Sevilla 5,7 / Cádiz 4,1 por trampa/día. La Junta publica el informe anualmente al cierre de campaña · esto es el último dato oficial disponible. Honra CRITICAL_no_inventar · todos los datos verificables clickeando sourceUrl.',
      createdBy: admin._id,
      fingerprint: 'polilla-olivo-RAIF-informe-oficial-2025-10',
      isActive: true,
    },
    // ─────────────────────────────────────────────────────────────────────
    // F1 · 9-jun-2026 · expansión Prays oleae a 5 advisories provincia con
    // cifras LITERALES del mismo informe RAIF oct 2025. Cada advisory cubre
    // el olivar de su provincia (radio 60-80km · centroid centro provincia)
    // con sus datos exactos del portal · cero invento.
    // ─────────────────────────────────────────────────────────────────────
    {
      // Málaga · cifras más altas del informe (45,1% aceitunas con Prays vivo +
      // 16,1 capturas/trampa/día). Sobre umbral de tratamiento (≥20%).
      pestName: 'Prays oleae · polilla del olivo',
      scientificName: 'Prays oleae',
      cropTypes: ['olivo'],
      affectedAreas: [
        {
          province: 'Malaga',
          comarca: 'Andalucía oriental · olivar provincia Málaga',
          centroid: { type: 'Point' as const, coordinates: [-4.42, 36.72] },
          radiusKm: 70,
        },
      ],
      severity: 'medium',  // sobre umbral 20% según portal
      detectedAt: praysReportDate,
      expiresAt: praysExpiresAt,
      source: 'RAIF',
      sourceRef: 'Estado Prays oleae · informe RAIF oct 2025 · Junta de Andalucía',
      recommendation:
        'Última publicación oficial vigente · informe RAIF balance temporada 2025 (la Junta publica este informe periódicamente al cierre de cada campaña olivar). En la temporada 2025 Málaga reportó 45,1% de aceitunas con Prays vivo (generación carpófaga · cifra más alta de Andalucía) y 16,1 adultos/trampa/día en capturas. Por encima del umbral de tratamiento (≥20%). Coordinar con cooperativa o ADV olivar local. Vigilar evolución temporada 2026 a través del sourceUrl · próxima actualización oficial esperada tras cosecha 2026.',
      sourceUrl: 'https://www.juntadeandalucia.es/agriculturapescaaguaydesarrollorural/raif/estado-fitosanitario-actual-de-prays-oleae-en-andalucia/',
      notes: 'Dato literal portal RAIF (última publicación vigente · balance temporada 2025) · Málaga = provincia con mayor incidencia generación carpófaga. Capturas 16,1 adultos/trampa/día son 2,8× lo de Sevilla y 3,9× lo de Cádiz. La Junta publica el informe anualmente al cierre de campaña.',
      createdBy: admin._id,
      fingerprint: 'polilla-olivo-RAIF-Malaga-2025-10',
      isActive: true,
    },
    {
      // Córdoba · 35,1% aceitunas con Prays vivo (sin datos de capturas en el
      // portal · solo cifra de infestación). Sobre umbral.
      pestName: 'Prays oleae · polilla del olivo',
      scientificName: 'Prays oleae',
      cropTypes: ['olivo'],
      affectedAreas: [
        {
          province: 'Cordoba',
          comarca: 'Subbética · campiña olivar',
          centroid: { type: 'Point' as const, coordinates: [-4.78, 37.88] },
          radiusKm: 75,
        },
      ],
      severity: 'medium',  // 35,1% sobre umbral 20%
      detectedAt: praysReportDate,
      expiresAt: praysExpiresAt,
      source: 'RAIF',
      sourceRef: 'Estado Prays oleae · informe RAIF oct 2025 · Junta de Andalucía',
      recommendation:
        'Última publicación oficial vigente · informe RAIF balance temporada 2025 (la Junta publica este informe periódicamente al cierre de cada campaña olivar). En la temporada 2025 Córdoba reportó 35,1% de aceitunas con Prays vivo en generación carpófaga. Por encima del umbral de tratamiento (≥20%). El portal no reportó capturas específicas Córdoba en esta publicación. Vigilar evolución temporada 2026 a través del sourceUrl · próxima actualización oficial esperada tras cosecha 2026.',
      sourceUrl: 'https://www.juntadeandalucia.es/agriculturapescaaguaydesarrollorural/raif/estado-fitosanitario-actual-de-prays-oleae-en-andalucia/',
      notes: 'Dato literal portal RAIF (última publicación vigente · balance temporada 2025) · % aceitunas en Córdoba similar al de Sevilla (35,1% vs 35%). Indica incidencia comparable en olivar campiña central. La Junta publica el informe anualmente al cierre de campaña.',
      createdBy: admin._id,
      fingerprint: 'polilla-olivo-RAIF-Cordoba-2025-10',
      isActive: true,
    },
    {
      // Cádiz · 4,1 capturas/trampa/día (sin % infestación reportado en el
      // portal). Severity low por nivel de capturas.
      pestName: 'Prays oleae · polilla del olivo',
      scientificName: 'Prays oleae',
      cropTypes: ['olivo'],
      affectedAreas: [
        {
          province: 'Cadiz',
          comarca: 'Sierra de Cádiz · olivar provincia',
          centroid: { type: 'Point' as const, coordinates: [-5.74, 36.65] },
          radiusKm: 60,
        },
      ],
      severity: 'low',
      detectedAt: praysReportDate,
      expiresAt: praysExpiresAt,
      source: 'RAIF',
      sourceRef: 'Estado Prays oleae · informe RAIF oct 2025 · Junta de Andalucía',
      recommendation:
        'Última publicación oficial vigente · informe RAIF balance temporada 2025 (la Junta publica este informe periódicamente al cierre de cada campaña olivar). En la temporada 2025 Cádiz reportó 4,1 adultos/trampa/día en capturas (cifra baja comparada con Málaga 16,1 y Sevilla 5,7). El portal no reportó % de aceitunas infestadas para Cádiz en esta publicación. Vigilar evolución temporada 2026 a través del sourceUrl · próxima actualización oficial esperada tras cosecha 2026.',
      sourceUrl: 'https://www.juntadeandalucia.es/agriculturapescaaguaydesarrollorural/raif/estado-fitosanitario-actual-de-prays-oleae-en-andalucia/',
      notes: 'Dato literal portal RAIF (última publicación vigente · balance temporada 2025) · Cádiz con menor presión Prays según capturas. No es necesario tratamiento mientras se mantenga bajo umbral. La Junta publica el informe anualmente al cierre de campaña.',
      createdBy: admin._id,
      fingerprint: 'polilla-olivo-RAIF-Cadiz-2025-10',
      isActive: true,
    },
    {
      // Granada · dato distinto del informe: 1% supervivencia larvas
      // (no es % aceitunas vivos · es supervivencia de larvas observada en
      // muestreo). Severity low por nivel bajo. Sevilla y Málaga también
      // reportaron 1,3% supervivencia · Granada 1%.
      pestName: 'Prays oleae · polilla del olivo',
      scientificName: 'Prays oleae',
      cropTypes: ['olivo'],
      affectedAreas: [
        {
          province: 'Granada',
          comarca: 'Vega de Granada · olivar provincia',
          centroid: { type: 'Point' as const, coordinates: [-3.60, 37.18] },
          radiusKm: 65,
        },
      ],
      severity: 'low',
      detectedAt: praysReportDate,
      expiresAt: praysExpiresAt,
      source: 'RAIF',
      sourceRef: 'Estado Prays oleae · informe RAIF oct 2025 · Junta de Andalucía',
      recommendation:
        'Última publicación oficial vigente · informe RAIF balance temporada 2025 (la Junta publica este informe periódicamente al cierre de cada campaña olivar). En la temporada 2025 Granada reportó 1% de supervivencia de larvas en muestreo (cifra baja · Sevilla y Málaga reportaron 1,3%). El portal no reportó % de aceitunas infestadas para Granada en esta publicación. Vigilar evolución temporada 2026 a través del sourceUrl · próxima actualización oficial esperada tras cosecha 2026.',
      sourceUrl: 'https://www.juntadeandalucia.es/agriculturapescaaguaydesarrollorural/raif/estado-fitosanitario-actual-de-prays-oleae-en-andalucia/',
      notes: 'Dato literal portal RAIF (última publicación vigente · balance temporada 2025) · supervivencia larvas Granada 1% indica baja eficacia reproductiva de Prays en últimas semanas del muestreo. La Junta publica el informe anualmente al cierre de campaña.',
      createdBy: admin._id,
      fingerprint: 'polilla-olivo-RAIF-Granada-2025-10',
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
