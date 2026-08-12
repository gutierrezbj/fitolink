import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as parcelService from '../services/parcelService.js';
import * as ndviSnapshotService from '../services/ndviSnapshotService.js';
import { getNdviForecastForParcel } from '../services/predictiveInsightService.js';
import { getWeatherEventsForParcel } from '../services/weatherEventsService.js';
import { fetchSoilProfileForParcel, buildMeasuredSoilProfile, polygonCentroid } from '../services/soilService.js';
import { z } from 'zod';
import { fetchActiveFiresNearParcel } from '../services/fireService.js';
import { computeIrrigationDecision } from '../services/irrigationDecisionService.js';
import { Parcel } from '../models/Parcel.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parcel = await parcelService.createParcel(req.user!._id.toString(), req.body);
    res.status(201).json({ success: true, data: parcel });
  } catch (error) {
    next(error);
  }
}

export async function createBulk(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { parcels } = req.body as { parcels: Parameters<typeof parcelService.createParcelsBulk>[1] };
    const created = await parcelService.createParcelsBulk(
      req.user!._id.toString(),
      parcels,
    );
    res.status(201).json({ success: true, data: created, meta: { count: created.length } });
  } catch (error) {
    next(error);
  }
}

export async function getMyParcels(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parcels = await parcelService.getParcelsByOwner(req.user!._id.toString());
    res.json({ success: true, data: parcels });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parcel = await parcelService.getParcelById(
      req.params.id as string,
      req.user!._id.toString(),
      { allowAdminRead: true, userRole: req.user!.role },
    );
    res.json({ success: true, data: parcel });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parcel = await parcelService.updateParcel(req.params.id as string, req.user!._id.toString(), req.body);
    res.json({ success: true, data: parcel });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await parcelService.deleteParcel(req.params.id as string, req.user!._id.toString());
    res.json({ success: true, data: { message: 'Parcela eliminada' } });
  } catch (error) {
    next(error);
  }
}

export async function getNdviHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await parcelService.getNdviHistory(
      req.params.id as string,
      req.user!._id.toString(),
      { allowAdminRead: true, userRole: req.user!.role },
    );
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
}

export async function getNdviSnapshot(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const snapshot = await ndviSnapshotService.getLatestSnapshot(
      req.params.id as string,
      req.user!._id.toString(),
      req.user!.role,
    );
    res.json({ success: true, data: snapshot ?? null });
  } catch (error) {
    next(error);
  }
}

export async function getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const { parcels, total } = await parcelService.getAllParcels(page, limit);
    res.json({ success: true, data: parcels, meta: { total, page, limit } });
  } catch (error) {
    next(error);
  }
}

/**
 * Sprint SoilGrids — refresh manual del perfil edáfico.
 * Consulta ISRIC SoilGrids v2.0 con el centroide de la parcela y
 * guarda el resultado en parcel.soil. Idempotente: cada llamada
 * sobrescribe el perfil anterior con datos frescos.
 *
 * Auth: el dueño de la parcela, admin global, o aseguradora si la
 * parcela está en su cartera. Mismo modelo que el resto de endpoints
 * de insight.
 */
export async function refreshSoilProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parcel = await parcelService.getParcelById(
      req.params.id as string,
      req.user!._id.toString(),
      { allowAdminRead: true, userRole: req.user!.role },
    );
    const profile = await fetchSoilProfileForParcel(parcel);
    await Parcel.updateOne({ _id: parcel._id }, { $set: { soil: profile } });
    logger.info(
      { parcelId: parcel._id.toString(), texture: profile.dominantTexture },
      'soil_profile_refreshed',
    );
    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error({ err: error, parcelId: req.params.id }, 'soil_profile_refresh_failed');
    next(error instanceof Error ? error : AppError.internal('SoilGrids fetch failed'));
  }
}

const measuredSoilSchema = z
  .object({
    clayPct: z.number().min(0).max(100),
    sandPct: z.number().min(0).max(100),
    siltPct: z.number().min(0).max(100),
    organicMatterPct: z.number().min(0).max(100),
    measuredOn: z.string().datetime().optional(),
    sampleLabel: z.string().max(120).optional(),
  })
  // La textura debe sumar ~100. Sin esto, un dígito omitido (suma 60) o el
  // degenerado 0/0/0 pasaría y la renormalización fabricaría una textura y una
  // capacidad de campo que el laboratorio nunca midió. Tolerancia ±3 por redondeo.
  .refine((d) => Math.abs(d.clayPct + d.sandPct + d.siltPct - 100) <= 3, {
    message: 'arcilla + arena + limo debe sumar ~100 (±3)',
  });

/**
 * Ingesta de un análisis de suelo REAL de laboratorio (textura + M.O.). Pisa
 * la estimación satelital de SoilGrids con dato medido por lote — mejora la
 * lógica de riego (retención de agua real, no estimada). Auth: dueño/admin.
 */
export async function setMeasuredSoil(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = measuredSoilSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.badRequest(parsed.error.issues[0]?.message ?? 'Datos de suelo no válidos');
    }
    // ESCRITURA → solo-dueño (sin allowAdminRead): la auth de lectura dejaría
    // que aseguradora/agregadores con la parcela en cartera PISARAN el suelo de
    // una parcela ajena. Mismo criterio estricto que update/delete de parcela.
    const parcel = await parcelService.getParcelById(
      req.params.id as string,
      req.user!._id.toString(),
    );
    const centroid = polygonCentroid(parcel.geometry as { coordinates: number[][][] });
    const profile = buildMeasuredSoilProfile(
      {
        clayPct: parsed.data.clayPct,
        sandPct: parsed.data.sandPct,
        siltPct: parsed.data.siltPct,
        organicMatterPct: parsed.data.organicMatterPct,
        measuredOn: parsed.data.measuredOn ? new Date(parsed.data.measuredOn) : undefined,
        sampleLabel: parsed.data.sampleLabel,
      },
      centroid,
    );
    // Estimación satelital para comparar. Aquí SOLO fuentes sin red (lo que ya
    // esté guardado): no bloqueamos la escritura del laboratorio con una llamada
    // a SoilGrids, que podría tardar o colgarse.
    let soilEstimate = parcel.soilEstimate;
    if (!soilEstimate && parcel.soil && parcel.soil.source === 'soilgrids-v2') {
      soilEstimate = parcel.soil;
    }
    const update: Record<string, unknown> = { soil: profile };
    if (soilEstimate) update.soilEstimate = soilEstimate;
    await Parcel.updateOne({ _id: parcel._id }, { $set: update });
    logger.info(
      { parcelId: parcel._id.toString(), texture: profile.dominantTexture, source: 'lab-measured', hasEstimate: !!soilEstimate },
      'soil_profile_measured_set',
    );
    res.json({ success: true, data: profile });

    // Si no había estimación guardada, se obtiene de SoilGrids FUERA del camino
    // crítico (fire-and-forget): la respuesta con el dato de laboratorio ya salió,
    // y la comparación aparecerá en la siguiente carga de la parcela.
    if (!soilEstimate) {
      const pid = parcel._id;
      void fetchSoilProfileForParcel(parcel)
        .then((est) => Parcel.updateOne({ _id: pid }, { $set: { soilEstimate: est } }))
        .catch((e) => logger.warn({ parcelId: pid.toString(), err: (e as Error).message }, 'soil_estimate_fetch_failed_on_measured'));
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Sprint FIRMS — focos térmicos activos cerca de la parcela.
 * Read-only, mismo auth pattern. Sin cache backend; el frontend
 * gestiona staleTime via react-query (NASA FIRMS actualiza ~3h).
 *
 * Query params (todos opcionales):
 *   radiusKm  default 25
 *   days      default 7, max 10
 *   includeLow  default false (filtra confidence 'l')
 */
export async function getNearbyFires(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parcel = await parcelService.getParcelById(
      req.params.id as string,
      req.user!._id.toString(),
      { allowAdminRead: true, userRole: req.user!.role },
    );
    const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : 25;
    const days = req.query.days ? Number(req.query.days) : 7;
    const includeLowConfidence = req.query.includeLow === 'true';
    const fires = await fetchActiveFiresNearParcel(parcel, { radiusKm, days, includeLowConfidence });
    res.json({ success: true, data: fires, meta: { radiusKm, days, count: fires.length } });
  } catch (error) {
    next(error);
  }
}

/**
 * Ola 1.5 Pieza 1 — NDVI trend + projected critical date for a parcel.
 * Read-only; same auth model as the parcel detail (owner / admin /
 * insurer of the parcel). Heavy lifting lives in predictiveInsightService.
 */
export async function getNdviForecast(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // Reuse parcelService.getParcelById's auth logic — fail closed before
    // computing anything if the user isn't authorised to see the parcel.
    await parcelService.getParcelById(
      req.params.id as string,
      req.user!._id.toString(),
      { allowAdminRead: true, userRole: req.user!.role },
    );
    const forecast = await getNdviForecastForParcel(req.params.id as string);
    res.json({ success: true, data: forecast });
  } catch (error) {
    next(error);
  }
}

/**
 * Ola 1.5 Pieza 2 — Personalised weather events for a parcel.
 * 7 rules over Open-Meteo 7-day forecast: cold/warm front, storm, low
 * pressure, frost, extreme heat, high wind. Same auth pattern as the
 * NDVI forecast endpoint.
 */
export async function getWeatherEvents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await parcelService.getParcelById(
      req.params.id as string,
      req.user!._id.toString(),
      { allowAdminRead: true, userRole: req.user!.role },
    );
    const data = await getWeatherEventsForParcel(req.params.id as string);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * Sprint BUMM Regantes · 05-jun-2026 · DECISIÓN DE RIEGO operativa para
 * gerentes de Comunidad de Regantes / ADV / Cooperativa. Cruza NDVI +
 * suelo + clima + cultivo en una recomendación clara: regar HOY,
 * en 3-5 días, vigilar o no requiere. Calcula cupo m³ aproximado y
 * cupo reducido por RD 950/2024 (-20%). Mismo auth pattern (cualquier
 * usuario que pueda ver la parcela puede ver su decisión).
 */
export async function getIrrigationDecision(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parcel = await parcelService.getParcelById(
      req.params.id as string,
      req.user!._id.toString(),
      { allowAdminRead: true, userRole: req.user!.role },
    );
    const decision = computeIrrigationDecision(parcel);
    res.json({ success: true, data: decision });
  } catch (error) {
    next(error);
  }
}
