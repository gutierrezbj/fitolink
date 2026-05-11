import dotenv from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';

// Load .env from monorepo root (workspace CWD is apps/api/)
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
dotenv.config(); // also try local .env for Docker/production

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4040),
  MONGODB_URI: z.string().url().or(z.string().startsWith('mongodb')),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Gmail SMTP via nodemailer — aligned with OverWatch's email stack since
  // both products operate under the SRS Google Workspace. App Password
  // recommended (not plain password). Leave SMTP_HOST empty to run in
  // dry-run mode where emails are logged structurally instead of sent.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('FitoLink Alertas <AlertasAgrom@systemrapid.io>'),
  COPERNICUS_CLIENT_ID: z.string().optional(),
  COPERNICUS_CLIENT_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
