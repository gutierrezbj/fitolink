import { Router } from 'express';
import authRoutes from './auth.js';
import parcelRoutes from './parcels.js';
import alertRoutes from './alerts.js';
import operationRoutes from './operations.js';
import adminRoutes from './admin.js';
import sigpacRoutes from './sigpac.js';
import marketplaceRoutes from './marketplace.js';
import cooperativeRoutes from './cooperative.js';
import pestAdvisoryRoutes from './pestAdvisories.js';
import contactRoutes from './contact.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/parcels', parcelRoutes);
router.use('/alerts', alertRoutes);
router.use('/operations', operationRoutes);
router.use('/admin', adminRoutes);
router.use('/sigpac', sigpacRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/cooperative', cooperativeRoutes);
router.use('/pest-advisories', pestAdvisoryRoutes);
router.use('/contact', contactRoutes);

export default router;
