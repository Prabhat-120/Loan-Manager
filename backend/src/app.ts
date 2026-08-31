import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { isDatabaseReady } from './config/database.js';
import { logger } from './common/logger/index.js';
import { errorHandler } from './common/middleware/error-handler.js';
import { NotFoundError } from './common/errors/app-error.js';

const app: Express = express();

// Global Middlewares
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(pinoHttp({ logger }));

// Liveness Probe
const healthHandler = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
};

// Readiness Probe (verifies MongoDB connection readiness)
const readyHandler = (_req: Request, res: Response): void => {
  const isReady = isDatabaseReady();
  if (isReady) {
    res.status(200).json({
      status: 'ready',
      db: 'connected',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'unhealthy',
      db: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
};

// Health endpoints at root and under /api/v1
app.get('/health', healthHandler);
app.get('/health/ready', readyHandler);

const apiV1Router = express.Router();
apiV1Router.get('/health', healthHandler);
apiV1Router.get('/health/ready', readyHandler);

app.use('/api/v1', apiV1Router);

// 404 Route Handler
app.use('*', (_req: Request, _res: Response, next) => {
  next(new NotFoundError('API Route Not Found'));
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
