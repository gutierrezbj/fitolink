import { Router } from 'express';
import authRoutes from './auth.js';
import parcelRoutes from './parcels.js';
import alertRoutes from './alerts.js';
import operationRoutes from './operations.js';
import adminRoutes from './admin.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/parcels', parcelRoutes);
router.use('/alerts', alertRoutes);
router.use('/operations', operationRoutes);
router.use('/admin', adminRoutes);

export default router;
