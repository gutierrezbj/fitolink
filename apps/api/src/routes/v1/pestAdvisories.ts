import { Router } from 'express';
import * as pestController from '../../controllers/pestAdvisoryController.js';
import { protect, authorize } from '../../middleware/auth.js';

const router = Router();

router.use(protect());
// Any authenticated user: advisories matching their own parcels (deduped).
// Declared before '/:id/...' routes so 'mine' never matches as an id.
router.get('/mine', pestController.getMine);
// Admin-only: create / list / deactivate
router.post('/', authorize('admin'), pestController.create);
router.get('/', authorize('admin'), pestController.list);
router.patch('/:id/deactivate', authorize('admin'), pestController.deactivate);

export default router;
