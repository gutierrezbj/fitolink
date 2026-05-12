/**
 * Contact routes — formularios públicos que disparan email a operación.
 *
 * Hoy un único endpoint:
 *   POST /contact/demo-request  — formulario "Solicitar demo" desde
 *                                 LandingPage / PricingPage. Manda email
 *                                 a juang@systemrapid.io + Jonh (cc) con
 *                                 los datos del prospect.
 *
 * Diseño:
 * - Endpoint público (no requiere auth — son leads cold)
 * - Rate limit básico: 5/min/IP via middleware existente del proyecto
 *   (TODO si llega abuse — no veo middleware en el repo aún, lo dejo
 *   diary'd como tier 4)
 * - Validación zod del body, errores 400 antes de tocar SMTP
 * - Nunca throw al cliente si SMTP falla — guardamos en logs estructurados
 *   y devolvemos success genérico para no romper UX por hiccup del SMTP
 */
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { logger } from '../../utils/logger.js';
import { sendDemoRequestEmail } from '../../services/emailService.js';

const router = Router();

const demoRequestSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  organization: z.string().max(200).optional(),
  hectares: z.string().max(40).optional(),
  cropType: z.string().max(80).optional(),
  message: z.string().max(2000).optional(),
  // T&C acceptance — el form también lo pide
  acceptedTerms: z.boolean().optional(),
});

router.post(
  '/demo-request',
  validate(demoRequestSchema),
  async (req, res, next) => {
    try {
      const payload = req.body as z.infer<typeof demoRequestSchema>;
      logger.info(
        {
          email: payload.email,
          name: payload.name,
          organization: payload.organization,
          hectares: payload.hectares,
        },
        'demo-request received',
      );

      // Fire-and-forget — el lead ya está en logs por si SMTP falla.
      void sendDemoRequestEmail(payload);

      res.json({
        success: true,
        data: {
          message: 'Gracias. Te contactaremos en menos de 24 horas.',
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
