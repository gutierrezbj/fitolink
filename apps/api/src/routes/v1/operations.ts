import { Router } from 'express';
import * as operationController from '../../controllers/operationController.js';
import { protect, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createOperationSchema, completeOperationSchema } from '@fitolink/shared';

const router = Router();

router.use(protect());

router.post('/', authorize('farmer'), validate(createOperationSchema), operationController.create);
router.get('/mine', authorize('farmer'), operationController.getMyOperations);
router.get('/assignments', authorize('pilot'), operationController.getAssignments);
router.get('/:id', operationController.getById);
router.patch('/:id/status', operationController.updateStatus);
router.patch('/:id/complete', authorize('pilot'), validate(completeOperationSchema), operationController.complete);

export default router;
