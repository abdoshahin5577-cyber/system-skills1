import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const healthyApp = () => createApp({ readinessChecks: [{ name: 'db', check: async () => undefined }] });

describe('health & error handling', () => {
  it('GET /health/live returns 200', async () => {
    const res = await request(healthyApp()).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /health/ready is 200 when all checks pass', async () => {
    const res = await request(healthyApp()).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.checks).toEqual({ db: 'up' });
  });

  it('GET /health/ready is 503 when a dependency is down', async () => {
    const app = createApp({
      readinessChecks: [{ name: 'redis', check: async () => Promise.reject(new Error('down')) }],
    });
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', checks: { redis: 'down' } });
  });

  it('unknown routes use the standard error envelope', async () => {
    const res = await request(healthyApp()).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('echoes a safe x-request-id and replaces an unsafe one', async () => {
    const ok = await request(healthyApp()).get('/health/live').set('x-request-id', 'abc12345-req');
    expect(ok.headers['x-request-id']).toBe('abc12345-req');
    const bad = await request(healthyApp()).get('/health/live').set('x-request-id', 'bad id<script>');
    expect(bad.headers['x-request-id']).not.toContain('<');
  });

  it('malformed JSON returns 400 INVALID_JSON', async () => {
    const res = await request(healthyApp())
      .post('/api/v1/anything')
      .set('content-type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('sets security headers and hides x-powered-by', async () => {
    const res = await request(healthyApp()).get('/health/live');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
