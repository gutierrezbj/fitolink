import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';
import app from './app.js';
import { startDigestCron, stopDigestCron } from './services/digestCron.js';

async function start(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);

  const server = app.listen(env.PORT, () => {
    logger.info(`FitoLink API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // Morning digest scheduler (Ola 1.5 · Pieza 4). Guarded by DIGEST_CRON
  // env so the API can ship with the code present but inactive until
  // the operator flips the flag and verifies a dry-run first.
  startDigestCron();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    stopDigestCron();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  logger.error({ error }, 'Failed to start server');
  process.exit(1);
});
