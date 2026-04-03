import { Router } from 'express';
import * as sigpacController from '../../controllers/sigpacController.js';

const router = Router();

// No auth required - public SIGPAC lookup
router.get('/lookup', sigpacController.lookupSigpac);

export default router;
