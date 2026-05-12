import { Router } from 'express';
import * as pestController from '../../controllers/pestAdvisoryController.js';
import { protect, authorize } from '../../middleware/auth.js';

const router = Router();

router.use(protect());
// Admin-only: create / list / deactivate
router.post('/', authorize('admin'), pestController.create);
router.get('/', authorize('admin'), pestController.list);
router.patch('/:id/deactivate', authorize('admin'), pestController.deactivate);

export default router;
