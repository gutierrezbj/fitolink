import { Router, type Request, type Response } from 'express';
import { protect } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { User } from '../../models/User.js';
import * as providerController from '../../controllers/providerController.js';
import { createLeadSchema } from '@fitolink/shared';

const router = Router();
router.use(protect());

// GET /marketplace/pilots — all verified pilots with location for map
router.get('/pilots', async (_req: Request, res: Response) => {
  const pilots = await User.find({ role: 'pilot', isVerified: true })
    .select('name company rating ratingCount operationalRadiusKm certifications equipment location')
    .sort({ rating: -1 })
    .lean();
  res.json({ success: true, data: pilots });
});

// GET /marketplace/providers — non-login directory entries
// (distributors, agronomic advisors, cooperatives)
router.get('/providers', providerController.list);

// POST /marketplace/leads — capture commercial interest
// (e.g. cooperative-program CTA)
router.post('/leads', validate(createLeadSchema), providerController.createLead);

export default router;
