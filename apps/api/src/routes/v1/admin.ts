import { Router, type Request, type Response } from 'express';
import { protect, authorize } from '../../middleware/auth.js';
import { User } from '../../models/User.js';
import { Operation } from '../../models/Operation.js';
import { getKpis } from '../../services/adminService.js';

const router = Router();

router.use(protect());
router.use(authorize('admin'));

// GET /admin/kpis — platform-wide KPI snapshot for the admin dashboard.
// Single round-trip; aggregations live server-side so the UI stays fast.
router.get('/kpis', async (_req: Request, res: Response) => {
  const kpis = await getKpis();
  res.json({ success: true, data: kpis });
});

// GET /admin/users — list all users (omit googleId)
router.get('/users', async (_req: Request, res: Response) => {
  const users = await User.find({})
    .select('-googleId')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: users });
});

// GET /admin/operations — all operations with full context for dispatcher
router.get('/operations', async (req: Request, res: Response) => {
  const { status } = req.query;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const operations = await Operation.find(filter)
    .populate('parcelId', 'name cropType province areaHa sigpacRef geometry')
    .populate('farmerId', 'name email phone')
    .populate('pilotId', 'name email phone rating')
    .populate('alertId', 'type severity ndviValue ndviDelta aiConfidence')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: operations });
});

// GET /admin/pilots — verified pilots for manual assignment
router.get('/pilots', async (_req: Request, res: Response) => {
  const pilots = await User.find({ role: 'pilot', isVerified: true })
    .select('name email phone rating ratingCount operationalRadiusKm certifications equipment location')
    .sort({ rating: -1 })
    .lean();
  res.json({ success: true, data: pilots });
});

// PATCH /admin/operations/:id/assign — manually assign pilot
router.patch('/operations/:id/assign', async (req: Request, res: Response) => {
  const { pilotId } = req.body;
  if (!pilotId) {
    res.status(400).json({ success: false, message: 'pilotId requerido' });
    return;
  }
  const op = await Operation.findByIdAndUpdate(
    req.params.id,
    { pilotId, status: 'assigned' },
    { new: true },
  )
    .populate('parcelId', 'name cropType province areaHa')
    .populate('farmerId', 'name email phone')
    .populate('pilotId', 'name email phone rating')
    .populate('alertId', 'type severity ndviValue ndviDelta');

  if (!op) {
    res.status(404).json({ success: false, message: 'Operacion no encontrada' });
    return;
  }
  res.json({ success: true, data: op });
});

// PATCH /admin/operations/:id/status — admin override of operation status
router.patch('/operations/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  const op = await Operation.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true },
  ).lean();
  if (!op) {
    res.status(404).json({ success: false, message: 'Operacion no encontrada' });
    return;
  }
  res.json({ success: true, data: op });
});

export default router;
