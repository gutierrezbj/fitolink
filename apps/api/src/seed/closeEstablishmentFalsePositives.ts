/**
 * Cierra alerts abiertas que el detector V2 creó sobre parcelas en
 * establecimiento (`establishmentPhase: true`) antes del fix del pipeline.
 *
 * Contexto · 13-may-2026
 * ----------------------
 * Auditoría reveló 2 alerts silenciosas sobre ZONA 2 del pistachar de
 * Jonh (status='new', severity=high y medium). El detector V2 las creó
 * pese al `learned_baseline` porque toda la historia de la parcela es
 * NDVI bajo (no hay z-score significativo).
 *
 * El pipeline a partir del commit 7d912a8 suprime estas alerts antes
 * de persistir. Pero las que ya están en BD hay que cerrarlas — el
 * cliente no las debe ver y NO deben contar como ground truth real
 * para el script de retrain.
 *
 * Lo que hace este script
 * -----------------------
 * Para cada parcela con `establishmentPhase: true`, busca sus alerts
 * en estado `new` o `notified` y las cierra con:
 *     status: 'resolved'
 *     resolvedBy: 'false_positive'
 *
 * Marcarlas como `false_positive` (no como `service` ni
 * `natural_recovery`) es honesto: son falsos positivos del detector,
 * generados antes del fix de supresión por contexto. Cuando el
 * retrain_from_ground_truth.py corra, las leerá como label 0 (healthy)
 * y el modelo aprenderá a no etiquetar estos casos como anomalía.
 *
 * Idempotente
 * -----------
 * Re-ejecutar el script no toca alerts ya `resolved`. Sólo cierra
 * abiertas. Reporta 0 modified si todo está limpio.
 *
 * Run via
 * -------
 *   docker compose exec -T api node apps/api/dist/seed/closeEstablishmentFalsePositives.js
 *   # con --dry-run para sólo reportar sin tocar:
 *   docker compose exec -T api node apps/api/dist/seed/closeEstablishmentFalsePositives.js --dry-run
 */
import mongoose from 'mongoose';
import { Parcel } from '../models/Parcel.js';
import { Alert } from '../models/Alert.js';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(MONGODB_URI);
  logger.info({ dryRun }, 'closeEstablishmentFalsePositives started');

  const establishmentParcels = await Parcel.find({ establishmentPhase: true })
    .select('_id name ownerId')
    .lean();
  if (establishmentParcels.length === 0) {
    logger.info('No parcelas with establishmentPhase=true — nothing to do');
    await mongoose.disconnect();
    return;
  }
  logger.info({ count: establishmentParcels.length }, 'Parcelas en establecimiento encontradas');

  const parcelIds = establishmentParcels.map((p) => p._id);

  const openAlerts = await Alert.find({
    parcelId: { $in: parcelIds },
    status: { $in: ['new', 'notified'] },
  })
    .select('_id parcelId severity ndviValue detectedAt')
    .lean();

  logger.info({ found: openAlerts.length }, 'Alerts abiertas a cerrar (false_positive)');
  for (const a of openAlerts) {
    const p = establishmentParcels.find((x) => x._id.toString() === a.parcelId.toString());
    logger.info(
      {
        parcel: p?.name,
        severity: a.severity,
        ndvi: a.ndviValue,
        detectedAt: a.detectedAt,
      },
      '  → cierre previsto',
    );
  }

  if (dryRun) {
    logger.info('dry-run · sin modificación');
    await mongoose.disconnect();
    return;
  }

  const result = await Alert.updateMany(
    { parcelId: { $in: parcelIds }, status: { $in: ['new', 'notified'] } },
    { $set: { status: 'resolved', resolvedBy: 'false_positive' } },
  );
  logger.info({ modified: result.modifiedCount }, 'Alerts cerradas como false_positive');

  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error({ err }, 'closeEstablishmentFalsePositives failed');
  process.exit(1);
});
