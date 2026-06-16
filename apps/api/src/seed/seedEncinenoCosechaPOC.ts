/**
 * Seed: backfill de la SERIE REAL Sentinel-2 (4 años) en la parcela demo
 * Encineño — base de la PRUEBA DE CONCEPTO del modelo de cosecha para el fondo.
 *
 * Carga ENCINENO_NDVI_HISTORY (350 lecturas REALES vía Microsoft Planetary
 * Computer, generadas desde sandbox/modelo-cosecha/encineno_s2_series.csv) en
 * `parcel.ndviHistory`, y marca `isSyntheticDemo=true` para que el pipeline V2
 * NO pise la serie curada (la cuenta demo-encineno@agrom.es es de demo, borrable
 * sin afectar a ningún cliente real).
 *
 * Honesto (regla nº1): son datos REALES de satélite, NO inventados. El "modelo"
 * (cuándo/cuánto) todavía NO entrena con dato del fondo — esto solo da vida a la
 * vista de la parcela con la señal real, que es la base de la demo del 17-jun
 * con Guillermo. La sección "Modelo de cosecha · POC" (UI) se deriva de esta
 * serie (envero NDRE de otoño) — pendiente de montar.
 *
 * Requiere que seedEncinenoDemo haya corrido antes (crea owner + parcela).
 *
 * Run en prod (rebuild API requerido para que entre al dist/):
 *   docker compose exec -T api node apps/api/dist/seed/seedEncinenoDemo.js
 *   docker compose exec -T api node apps/api/dist/seed/seedEncinenoCosechaPOC.js
 */
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Parcel } from "../models/Parcel.js";
import { logger } from "../utils/logger.js";
import { ENCINENO_NDVI_HISTORY } from "./data/encinenoNdviHistory.js";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:6040/fitolink";

const OWNER_EMAIL = "demo-encineno@agrom.es";
const PARCEL_NAME = "Finca Encineño · Sector 407 ha";

async function seedEncinenoCosechaPOC(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  logger.info("Connected to MongoDB for Encineño cosecha POC seed");

  const owner = await User.findOne({ email: OWNER_EMAIL });
  if (!owner) {
    logger.error(
      "Owner demo-encineno@agrom.es no existe — corre seedEncinenoDemo primero",
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const parcel = await Parcel.findOne({
    name: PARCEL_NAME,
    ownerId: owner._id,
  });
  if (!parcel) {
    logger.error(
      "Parcela Encineño no existe — corre seedEncinenoDemo primero",
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  // Backfill de la serie real (mean=NDVI, ndreValue=NDRE, ndmiValue=NDMI).
  // min=max=mean: solo guardamos la media zonal — no inventamos un rango.
  parcel.set(
    "ndviHistory",
    ENCINENO_NDVI_HISTORY.map((p) => ({
      date: new Date(p.date),
      mean: p.mean,
      min: p.min,
      max: p.max,
      anomalyDetected: false,
      source: "sentinel2",
      ndreValue: p.ndreValue,
      ndmiValue: p.ndmiValue,
    })),
  );
  // Proteger la serie curada y dejar la parcela calibrada (olivar maduro de secano).
  parcel.isSyntheticDemo = true;
  parcel.plantingYear = 1990;
  parcel.establishmentPhase = false;
  parcel.calibratingUntil = null;
  await parcel.save();

  logger.info(
    { id: parcel._id.toString(), readings: ENCINENO_NDVI_HISTORY.length },
    "Encineño cosecha POC: serie real Sentinel-2 backfilled",
  );

  await mongoose.disconnect();
  logger.info("Encineño cosecha POC seed completed");
}

seedEncinenoCosechaPOC().catch((err) => {
  logger.error({ err }, "seedEncinenoCosechaPOC failed");
  process.exit(1);
});
