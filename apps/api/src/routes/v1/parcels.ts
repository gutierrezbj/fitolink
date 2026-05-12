import { Router } from 'express';
import * as parcelController from '../../controllers/parcelController.js';
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

// Admin routes
router.get('/', authorize('admin'), parcelController.getAll);

export default router;
