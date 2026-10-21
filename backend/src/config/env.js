import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().url().default('http://localhost:4200'),
  FRONTEND_URL: z.string().url().default('http://localhost:4200'),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().regex(/^\d+d$/).default('30d'),
  EVENT_GALLERY_MAX_IMAGES: z.coerce.number().int().min(1).max(100).default(24),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional()
});

export const env = schema.parse(process.env);

export function frontendOrigins() {
  const origins = new Set([env.CORS_ORIGIN, env.FRONTEND_URL]);
  if (env.NODE_ENV !== 'production') {
    for (const origin of [...origins]) {
      const url = new URL(origin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        url.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
        origins.add(url.origin);
      }
    }
  }
  return [...origins];
}

export function requireDatabaseUrl() {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return env.DATABASE_URL;
}

export function requireAuthSecrets() {
  if (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET)
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required');
  return { access: env.JWT_ACCESS_SECRET, refresh: env.JWT_REFRESH_SECRET };
}
