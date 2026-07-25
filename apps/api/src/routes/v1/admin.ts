import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { protect, authorize } from '../../middleware/auth.js';
import * as adminController from '../../controllers/adminController.js';
import * as kmzImportController from '../../controllers/kmzImportController.js';

const router = Router();

router.use(protect());
router.use(authorize('admin'));

// Rate-limit específico para el listado de usuarios: devuelve PII de toda
// la plataforma, así que limitamos el ritmo de consulta por IP aunque la
// ruta ya esté tras auth+authorize('admin'). 30 req / 5 min basta para el
// refetch del dashboard (cada 120s) sin abrir la puerta a scraping masivo.
const usersRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas peticiones, intentalo mas tarde' },
});

router.get('/kpis', adminController.getKpisHandler);
router.get('/alerts/timeline', adminController.getAlertTimelineHandler);
router.get('/users', usersRateLimit, adminController.getUsersHandler);
router.get('/operations', adminController.getOperationsHandler);
router.get('/pilots', adminController.getPilotsHandler);
router.patch('/operations/:id/assign', adminController.assignPilotHandler);
router.patch('/operations/:id/status', adminController.updateStatusHandler);

// Sprint Bridge DJI -> FitoLink · Fase 0 · import de parcelas bajo un cliente.
// El KMZ/KML del mando Agras se parsea en el frontend (lib/missionParser);
// aquí llega ya como geometrías GeoJSON + cliente destino (existente o nuevo).
router.post('/parcels/import', kmzImportController.importParcels);

export default router;
