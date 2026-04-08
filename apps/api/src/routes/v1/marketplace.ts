import { Router, type Request, type Response } from 'express';
import { protect } from '../../middleware/auth.js';
import { User } from '../../models/User.js';

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

export default router;
