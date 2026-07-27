/**
 * Runner · ingesta RAIF (Prays oleae) + fan-out de alertas de plaga.
 *
 * El corazón del "sistema de notificación de plagas" (12-jul-2026):
 *   1. raifIngestService descarga y parsea el informe Prays del portal
 *      RAIF. Solo ingesta si el portal publicó un informe MÁS NUEVO que
 *      lo que ya hay en la BD (gate por fecha — cero frescura fabricada).
 *   2. Si ingestó, dispara el fan-out: una Alert 'pest_advisory' por cada
 *      parcela activa de olivo dentro del radio provincial del aviso
 *      (idempotente — re-ejecutar no duplica alertas abiertas).
 *
 * FAIL-CLOSED: si el portal no responde o su HTML cambió y el parser no
 * extrae fecha/cifras, sale con exit code 1 SIN tocar la BD — el tablón
 * conserva la última verdad verificada y el cron deja rastro en logs.
 *
 * Ejecutar (manual):
 *   docker compose -f docker-compose.prod.yml exec -T api node apps/api/dist/ingest/ingestRaif.js
 *   # o con --force para re-ingerir aunque la fecha no sea más nueva (pruebas):
 *   docker compose -f docker-compose.prod.yml exec -T api node apps/api/dist/ingest/ingestRaif.js --force
 *
 * Programar (crontab del HOST del VPS, mismo patrón que el geo-pipeline —
 * lunes 07:30, el portal publica en horario de oficina):
 *   30 7 * * 1 cd /opt/fitolink && docker compose -f docker-compose.prod.yml exec -T api node apps/api/dist/ingest/ingestRaif.js >> /var/log/fitolink-ingest.log 2>&1
 *
 * Ver docs/ingesta-avisos.md para el runbook completo.
 */
import mongoose from 'mongoose';
import { PestAdvisory } from '../models/PestAdvisory.js';
import { ingestPraysReport, RaifParseError } from '../services/raifIngestService.js';
import { fanOutAdvisoryAlerts } from '../services/pestAdvisoryService.js';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

async function main() {
  const force = process.argv.includes('--force');
  await mongoose.connect(MONGODB_URI);
  logger.info({ force }, 'ingestRaif · connected, starting ingest');

  const result = await ingestPraysReport({ force });

  if (result.status === 'up-to-date') {
    logger.info(
      {
        reportPublishedAt: result.reportPublishedAt?.toISOString().slice(0, 10),
        latestInDb: result.latestInDb?.toISOString().slice(0, 10),
      },
      'ingestRaif · portal sin publicación nueva',
    );
  } else {
    logger.info(
      {
        reportPublishedAt: result.reportPublishedAt?.toISOString().slice(0, 10),
        advisoriesInserted: result.inserted,
        advisoriesDeleted: result.deleted,
      },
      'ingestRaif · informe nuevo ingerido',
    );
  }

  // Fan-out en CADA run (también en up-to-date), sobre TODOS los avisos
  // vigentes — no solo los Prays recién ingeridos. Es idempotente (dedupe
  // por parcela+fingerprint), así que el caso normal crea 0 alertas; lo que
  // compra es robustez: bootstrap del primer deploy (el gate por fecha no
  // dispara ingesta pero las alertas deben existir), reintento si un run
  // anterior murió tras la ingesta y antes del fan-out, avisos creados a
  // mano por el admin, y parcelas dadas de alta DESPUÉS del aviso.
  // (Hallazgos 1/2/12 de la revisión adversarial 12-jul-2026.)
  // `notifyParcels: {$ne:false}` — el barrido recorre TODOS los avisos vigentes,
  // no solo los Prays, y desde la ingesta del boletín semanal hay avisos que se
  // publican en el tablón pero que deliberadamente NO deben llegar a la
  // campanita (ver FANOUT_POLICY en raifWeeklyIngest.ts). Sin este filtro, este
  // cron anularía esa política dos días después de aplicarse. Con $ne:false los
  // avisos antiguos, que no tienen el campo, siguen entrando como siempre.
  const vigentes = await PestAdvisory.find({
    isActive: true,
    expiresAt: { $gte: new Date() },
    notifyParcels: { $ne: false },
  });
  let totalCreated = 0;
  let totalMatched = 0;
  for (const advisory of vigentes) {
    const fan = await fanOutAdvisoryAlerts(advisory);
    totalCreated += fan.alertsCreated;
    totalMatched += fan.parcelsMatched;
  }

  logger.info(
    {
      ingestStatus: result.status,
      advisoriesSwept: vigentes.length,
      parcelsMatched: totalMatched,
      alertsCreated: totalCreated,
    },
    'ingestRaif · COMPLETED — barrido de fan-out terminado',
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  if (err instanceof RaifParseError) {
    logger.error(
      { err: err.message, htmlExcerpt: err.htmlExcerpt },
      'ingestRaif · PARSE ERROR — el HTML del portal cambió; la ingesta abortó sin tocar avisos (fail-closed)',
    );
  } else {
    // Ojo: si el error llegó DESPUÉS de ingestPraysReport, la ingesta ya
    // está commiteada — solo faltaría el fan-out, que el siguiente run
    // completa (barrido idempotente).
    logger.error({ err: (err as Error).message }, 'ingestRaif · fatal error — el siguiente run del cron completa lo pendiente');
  }
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
