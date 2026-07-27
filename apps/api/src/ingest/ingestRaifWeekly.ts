/**
 * Runner · boletín semanal provincial del RAIF (7 de las 8 provincias).
 *
 * Complementa a ingestRaif.ts, que solo trae el informe de Prays del olivar.
 * Este recorre el boletín multicultivo de cada provincia y publica un aviso
 * por (provincia · cultivo · plaga · semana).
 *
 * FAIL-CLOSED por provincia: si un PDF no descarga, no trae fecha interna, la
 * trae vieja o cambió de maquetación, esa provincia se salta con status
 * 'error' y las demás siguen. Nunca se publica un boletín sin fecha propia.
 *
 * IDEMPOTENTE: el fingerprint incluye la semana del boletín, así que repetir
 * el run dentro de la misma semana no inserta nada. La semana siguiente entra
 * un juego nuevo y el anterior caduca solo (expiresAt = fin de periodo + 10 d).
 *
 * Con --dry-run parsea e imprime lo que publicaría SIN tocar la BD. Es la
 * forma de revisar el volumen antes de cambiar FANOUT_POLICY.
 *
 * Ejecutar (manual):
 *   docker compose -f docker-compose.prod.yml exec -T api node apps/api/dist/ingest/ingestRaifWeekly.js --dry-run
 *   docker compose -f docker-compose.prod.yml exec -T api node apps/api/dist/ingest/ingestRaifWeekly.js
 *
 * Programar: ver ops/crontab (viernes, que el boletín cubre de lunes a viernes).
 *
 * Requiere poppler-utils en la imagen (docker/Dockerfile.api).
 */
import mongoose from 'mongoose';
import { RAIF_PROVINCE_INDEX, ingestProvinceWeekly } from './raifWeeklyIngest.js';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!dryRun) await mongoose.connect(MONGODB_URI);
  logger.info({ dryRun, provinces: RAIF_PROVINCE_INDEX.length }, 'ingestRaifWeekly · starting');

  let planned = 0;
  let highlighted = 0;
  const failed: string[] = [];
  const unmapped = new Set<string>();

  for (const entry of RAIF_PROVINCE_INDEX) {
    const r = await ingestProvinceWeekly(entry, { dryRun });
    if (r.status === 'error') {
      failed.push(`${r.province}: ${r.error}`);
      logger.warn({ province: r.province, err: r.error }, 'ingestRaifWeekly · provincia saltada');
      continue;
    }
    planned += r.planned.length;
    highlighted += r.planned.filter((p) => p.highlightedBySource).length;
    r.unmapped.forEach((c) => unmapped.add(c));
    logger.info(
      { province: r.province, period: r.periodLiteral, avisos: r.planned.length },
      'ingestRaifWeekly · provincia procesada',
    );
  }

  // Los cultivos sin mapear son la señal de que el boletín trae material que
  // estamos tirando: revisar CROP_HEADER_MAP cuando aparezcan.
  if (unmapped.size > 0) {
    logger.warn({ crops: [...unmapped] }, 'ingestRaifWeekly · cultivos del boletín sin mapear');
  }

  logger.info(
    { dryRun, avisos: planned, destacadosPorLaFuente: highlighted, provinciasFallidas: failed },
    'ingestRaifWeekly · COMPLETED',
  );

  if (!dryRun) await mongoose.disconnect();
  // Solo se considera fallo que caigan TODAS: que una provincia no publique
  // esta semana es normal y no debe teñir el cron de rojo.
  process.exit(failed.length === RAIF_PROVINCE_INDEX.length ? 1 : 0);
}

main().catch(async (err) => {
  logger.error(
    { err: (err as Error).message },
    'ingestRaifWeekly · fatal error — el run de la semana que viene lo recoge',
  );
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
