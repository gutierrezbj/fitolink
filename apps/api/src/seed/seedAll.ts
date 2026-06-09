/**
 * seedAll · orquestador idempotente de todos los seeds de producción.
 *
 * Sprint deudas técnicas A3 · 05-jun-2026.
 *
 * Ejecuta cada seed individual en un subprocess separado para que cada
 * uno gestione su propia conexión Mongo + cleanup. Si uno falla, el
 * orquestador lo reporta y continúa con el siguiente (no abortamos toda
 * la cadena por un seed que ya está al día).
 *
 * Orden de ejecución importa: providers (directorio público) → pest
 * advisories (alertas comarca) → cooperative + regantes (entidades
 * agregadoras) → professor demo (Aula Jaén). El seed principal (seed.ts)
 * NO se incluye porque tiene su propio guard "real pipeline data
 * detected" y solo aplica al BD vacía/dev — en prod no lo queremos
 * ejecutar nunca tras el primer arranque.
 *
 * Ejecutar:
 *   docker compose exec -T api node apps/api/dist/seed/seedAll.js
 *
 * Equivalente a ejecutar manualmente:
 *   docker compose exec -T api node apps/api/dist/seed/seedProviders.js
 *   docker compose exec -T api node apps/api/dist/seed/seedPestAdvisories.js
 *   docker compose exec -T api node apps/api/dist/seed/seedCooperativeSocios.js
 *   docker compose exec -T api node apps/api/dist/seed/seedRegantesSocios.js
 *   docker compose exec -T api node apps/api/dist/seed/seedProfessorDemo.js
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Orden importa: dependencias primero. cooperative/regantes asumen que
// los proveedores ya están en directorio (Sprint Providers).
const SEEDS = [
  { name: 'seedProviders',              file: 'seedProviders.js' },
  { name: 'seedPestAdvisories',         file: 'seedPestAdvisories.js' },         // RAIF Andalucía (olivo)
  { name: 'seedPestAdvisoriesDARP',     file: 'seedPestAdvisoriesDARP.js' },     // DARP Catalunya · Bloque C 8-jun-2026
  { name: 'seedPestAdvisoriesLevante',  file: 'seedPestAdvisoriesLevante.js' },  // SAIF Valencia + SIAM Murcia · cítricos Vega Baja 9-jun-2026
  { name: 'seedCooperativeSocios',      file: 'seedCooperativeSocios.js' },
  { name: 'seedRegantesSocios',         file: 'seedRegantesSocios.js' },
  { name: 'seedProfessorDemo',          file: 'seedProfessorDemo.js' },
];

interface SeedResult {
  name: string;
  exitCode: number;
  durationMs: number;
}

function runSeed(name: string, file: string): Promise<SeedResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const seedPath = join(__dirname, file);
    logger.info({ name, file }, '▶ running seed');

    const child = spawn(process.execPath, [seedPath], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - start;
      const exitCode = code ?? 1;
      if (exitCode === 0) {
        logger.info({ name, durationMs }, '✓ seed completed');
      } else {
        logger.error({ name, exitCode, durationMs }, '✗ seed failed');
      }
      resolve({ name, exitCode, durationMs });
    });

    child.on('error', (err) => {
      logger.error({ name, err: err.message }, '✗ seed spawn error');
      resolve({ name, exitCode: 1, durationMs: Date.now() - start });
    });
  });
}

async function main(): Promise<void> {
  logger.info({ count: SEEDS.length }, '═══ seedAll · iniciando orquestación de seeds de prod ═══');

  const results: SeedResult[] = [];
  for (const seed of SEEDS) {
    const result = await runSeed(seed.name, seed.file);
    results.push(result);
  }

  const ok = results.filter((r) => r.exitCode === 0).length;
  const fail = results.filter((r) => r.exitCode !== 0).length;
  const totalMs = results.reduce((s, r) => s + r.durationMs, 0);

  logger.info(
    {
      total: results.length,
      ok,
      fail,
      durationMs: totalMs,
      results,
    },
    fail === 0 ? '═══ seedAll completed cleanly ═══' : '═══ seedAll completed with failures ═══',
  );

  // Exit code = 1 si algún seed falló, 0 si todos OK.
  // Útil para CI/CD si en el futuro se ejecuta este script en un pipeline.
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  logger.error({ err }, 'seedAll fatal error');
  process.exit(1);
});
