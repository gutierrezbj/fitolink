import { Router } from 'express';
import * as cooperativeController from '../../controllers/cooperativeController.js';
import { protect, authorize } from '../../middleware/auth.js';

const router = Router();
router.use(protect());
// 05-jun-2026 · autorizar también roles 'adv' y 'regantes' — todos
// agregan farmers vía cooperativeId, mismo shape de respuesta.
// La diferenciación semántica vive en el frontend.
router.use(authorize('cooperative', 'adv', 'regantes', 'admin'));

// Aggregated KPIs + members + parcel geometry for the cooperative dashboard.
// Admins can also call it for a given cooperative (V2 — filter by `:id`).
router.get('/overview', cooperativeController.overview);

// Bloque B · 05-jun-2026 · descarga reporte cartera PDF/CSV.
// Query: ?format=pdf | ?format=csv
router.get('/report', cooperativeController.downloadReport);

export default router;
