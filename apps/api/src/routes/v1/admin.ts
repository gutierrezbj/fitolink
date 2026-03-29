import { Router, type Request, type Response } from 'express';
import { protect, authorize } from '../../middleware/auth.js';
import { User } from '../../models/User.js';

const router = Router();

router.use(protect());
router.use(authorize('admin'));

// GET /admin/users — list all users (omit googleId)
router.get('/users', async (_req: Request, res: Response) => {
  const users = await User.find({})
    .select('-googleId')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: users });
});

export default router;
