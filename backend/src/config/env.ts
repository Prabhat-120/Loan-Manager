import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().transform(Number).default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required').default('mongodb://localhost:27017/loan-manager'),
  CORS_ORIGIN: z.string().default('http://localhost:5173')
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', _env.error.format());
  throw new Error('Invalid environment variables');
}

export const env = _env.data;
