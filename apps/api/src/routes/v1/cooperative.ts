import { Router } from 'express';
import * as cooperativeController from '../../controllers/cooperativeController.js';
import { protect, authorize } from '../../middleware/auth.js';

const router = Router();
router.use(protect());
router.use(authorize('cooperative', 'admin'));

// Aggregated KPIs + members + parcel geometry for the cooperative dashboard.
// Admins can also call it for a given cooperative (V2 — filter by `:id`).
router.get('/overview', cooperativeController.overview);

export default router;
