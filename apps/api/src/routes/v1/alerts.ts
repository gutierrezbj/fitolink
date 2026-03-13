import { Router } from 'express';
import * as alertController from '../../controllers/alertController.js';
import { protect, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { updateAlertSchema } from '@fitolink/shared';

const router = Router();

router.use(protect());

router.get('/mine', authorize('farmer'), alertController.getMyAlerts);
router.get('/active', authorize('admin'), alertController.getActive);
router.get('/parcel/:parcelId', alertController.getByParcel);
router.patch('/:id', validate(updateAlertSchema), alertController.update);

export default router;
