import { Router } from 'express';
import * as parcelController from '../../controllers/parcelController.js';
import { getForParcel as getPestAdvisoriesForParcel } from '../../controllers/pestAdvisoryController.js';
import { protect, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createParcelSchema, updateParcelSchema, bulkCreateParcelSchema } from '@fitolink/shared';

const router = Router();

// All routes require auth
router.use(protect());

// Farmer routes
router.post('/', authorize('farmer'), validate(createParcelSchema), parcelController.create);
router.post('/bulk', authorize('farmer'), validate(bulkCreateParcelSchema), parcelController.createBulk);
router.get('/mine', authorize('farmer'), parcelController.getMyParcels);
router.get('/:id', parcelController.getById);
router.put('/:id', authorize('farmer'), validate(updateParcelSchema), parcelController.update);
router.delete('/:id', authorize('farmer'), parcelController.remove);
router.get('/:id/ndvi-history', parcelController.getNdviHistory);
router.get('/:id/ndvi-snapshot', parcelController.getNdviSnapshot);
// Predictive insight — NDVI trend + projected days to critical threshold
router.get('/:id/insights/ndvi-forecast', parcelController.getNdviForecast);
// Predictive insight — Personalised weather events (cold/warm front, storm, frost, heat, wind)
router.get('/:id/insights/weather-events', parcelController.getWeatherEvents);
// Predictive insight — Curated pest advisories matching parcel crop + comarca radius
router.get('/:id/insights/pest-advisories', getPestAdvisoriesForParcel);
// Sprint SoilGrids — refresh manual del perfil edáfico ISRIC 250m
router.post('/:id/soil/refresh', parcelController.refreshSoilProfile);
// Ingesta de análisis de suelo REAL de laboratorio (textura + M.O.) → pisa la
// estimación satelital. Diana Marcela (aguacate RD), 10-ago-2026.
router.post('/:id/soil/measured', parcelController.setMeasuredSoil);
// Sprint FIRMS — focos térmicos activos cerca de la parcela (NASA VIIRS)
router.get('/:id/fires', parcelController.getNearbyFires);
// Sprint BUMM Regantes · DECISIÓN DE RIEGO operativa (NDVI + suelo + clima → m³)
router.get('/:id/insights/irrigation-decision', parcelController.getIrrigationDecision);

// Admin routes
router.get('/', authorize('admin'), parcelController.getAll);

export default router;
