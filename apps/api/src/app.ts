import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import v1Routes from './routes/v1/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

const app = express();

// Confiar en 1 hop de proxy (el nginx del host delante del contenedor). Sin
// esto, req.ip = IP del proxy para TODOS los visitantes → el rate-limit usaría
// un único cubo global (un pico de audiencia o un bucle daría 429 a todos) y
// express-rate-limit escupiría ERR_ERL_UNEXPECTED_X_FORWARDED_FOR en cada
// petición. Con trust proxy=1, req.ip = X-Forwarded-For real → rate-limit
// per-IP como se pretende. Valor numérico (no `true`) para no abrir spoofing.
app.set('trust proxy', 1);

// Cabeceras de seguridad (helmet)
// CSP DESACTIVADA a propósito: el SPA carga tiles de mapas (Esri/satélite),
// Google OAuth y assets que una política por defecto rompería. Mantenemos el
// resto de cabeceras seguras (X-Content-Type-Options, X-Frame-Options, HSTS,
// Referrer-Policy). crossOriginEmbedderPolicy desactivada por el mismo motivo
// (recursos cross-origin de los proveedores de tiles).
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS con allowlist
// En producción web y API comparten origen (nginx proxya /api) → muchas
// peticiones llegan sin cabecera Origin. En dev el web corre en :3040 (Vite
// proxya /api → :4040). Permitimos el origen de producción + los de dev.
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://fitolink.agrom.es',
  'http://localhost:3040',
  'http://localhost:5173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Sin Origin (curl, healthchecks, mismo origen) → permitir.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url }, 'Request');
  next();
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'fitolink-api', timestamp: new Date().toISOString() });
});

// API v1 routes
app.use('/api/v1', v1Routes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
