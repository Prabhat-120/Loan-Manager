import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().transform(Number).default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required').default('mongodb://localhost:27017/loan-manager'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().default('supersecretjwtaccesskey_for_dev_test_mode_at_least_32_chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().default('supersecretjwtrefreshkey_for_dev_test_mode_at_least_32_chars'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d')
}).refine((data) => {
  if (data.NODE_ENV === 'production') {
    return data.JWT_SECRET.length >= 32 && data.REFRESH_TOKEN_SECRET.length >= 32;
  }
  return true;
}, {
  message: 'In production, JWT_SECRET and REFRESH_TOKEN_SECRET must be at least 32 characters long',
  path: ['JWT_SECRET']
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', _env.error.format());
  throw new Error('Invalid environment variables');
}

export const env = _env.data;
