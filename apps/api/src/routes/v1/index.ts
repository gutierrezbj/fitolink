import { Router } from 'express';
import authRoutes from './auth.js';
import parcelRoutes from './parcels.js';
import alertRoutes from './alerts.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/parcels', parcelRoutes);
router.use('/alerts', alertRoutes);

export default router;
