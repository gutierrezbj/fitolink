import { Router } from 'express';
import * as authController from '../../controllers/authController.js';
import { protect } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { loginGoogleSchema, registerSchema } from '@fitolink/shared';

const router = Router();

router.post('/login/google', validate(loginGoogleSchema), authController.login);
router.post('/login/dev', authController.devLogin);
router.post('/register', validate(registerSchema), authController.register);
router.get('/me', protect(), authController.me);

export default router;
