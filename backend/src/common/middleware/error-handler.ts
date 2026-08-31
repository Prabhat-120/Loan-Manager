import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logger/index.js';
import { env } from '../../config/env.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        statusCode: err.statusCode,
        ...(err.details ? { details: err.details } : {})
      }
    });
    return;
  }

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    res.status(400).json({
      success: false,
      error: {
        message: message || 'Validation failed',
        statusCode: 400,
        details: err.errors
      }
    });
    return;
  }

  logger.error('Unhandled Exception:', err);

  res.status(500).json({
    success: false,
    error: {
      message: 'Internal Server Error',
      statusCode: 500,
      ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    }
  });
};
