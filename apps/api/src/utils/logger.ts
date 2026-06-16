import pino from 'pino';

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  // Redaction de campos sensibles para que credenciales/tokens nunca acaben
  // en logs (SMTP_PASS, Authorization, secrets, etc.). El repo puede ser
  // público y los logs se comparten en debugging.
  redact: {
    paths: [
      'password',
      '*.password',
      '*.pass',
      'SMTP_PASS',
      '*.SMTP_PASS',
      'token',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      'authorization',
      '*.authorization',
      'req.headers.authorization',
      'headers.authorization',
      '*.secret',
      'secret',
      'apiKey',
      '*.apiKey',
    ],
    censor: '[redacted]',
  },
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
