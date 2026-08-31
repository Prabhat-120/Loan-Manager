import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import * as dbModule from '../config/database.js';

describe('Health API Endpoints', () => {
  it('GET /health should return 200 OK with liveness details', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('timestamp');
  });

  it('GET /api/v1/health should return 200 OK', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
  });

  it('GET /health/ready should return 200 when database is ready', async () => {
    vi.spyOn(dbModule, 'isDatabaseReady').mockReturnValue(true);
    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ready');
    expect(response.body).toHaveProperty('db', 'connected');
  });

  it('GET /health/ready should return 503 when database is not ready', async () => {
    vi.spyOn(dbModule, 'isDatabaseReady').mockReturnValue(false);
    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty('status', 'unhealthy');
    expect(response.body).toHaveProperty('db', 'disconnected');
  });
});
