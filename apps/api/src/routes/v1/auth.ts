import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../../controllers/authController.js';
import { protect } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { loginGoogleSchema, registerSchema } from '@fitolink/shared';

const router = Router();

// Rate-limit para las rutas sensibles de alta/acceso: el dev-login por email
// puede auto-crear cuentas (spam/contaminación de la BD de prod) y /register
// es la superficie de intentos de escalada. Límite holgado para no romper
// demos legítimas (varios clicks de chip), pero acota el abuso automatizado.
const authRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas peticiones, intentalo mas tarde' },
});

router.post('/login/google', validate(loginGoogleSchema), authController.login);
router.post('/login/dev', authRateLimit, authController.devLogin);
router.post('/login/dev/email', authRateLimit, authController.devLoginByEmail);
router.post('/register', authRateLimit, validate(registerSchema), authController.register);
router.get('/me', protect(), authController.me);

export default router;
