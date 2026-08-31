import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skip: () => env.NODE_ENV === 'test',
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts. Please try again later.',
      statusCode: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: () => env.NODE_ENV === 'test',
  message: {
    success: false,
    error: {
      message: 'Too many password reset requests. Please try again later.',
      statusCode: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});
