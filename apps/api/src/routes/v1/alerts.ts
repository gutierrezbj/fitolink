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

// On-demand resend of an alert as email — admin only.
// Useful for demos: open a real alert from staging and send its email to a
// prospect's address. Accepts optional { to, name } in body to override.
router.post('/:id/resend-email', authorize('admin'), alertController.resendEmail);

export default router;
