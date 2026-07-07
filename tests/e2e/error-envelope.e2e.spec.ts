import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createE2eApp, AUTH, type TestApp } from '../utils/e2e-app.js';

/**
 * INV-HTTP-001 — every error, regardless of status, is rendered as exactly
 * `{ returnCode, message }` with returnCode === HTTP status. No other shape leaks.
 */
let ctx: TestApp;
beforeAll(async () => {
  ctx = await createE2eApp();
});
afterAll(async () => {
  await ctx.close();
});

const assertEnvelope = (res: request.Response, status: number): void => {
  expect(res.status).toBe(status);
  expect(Object.keys(res.body).sort()).toEqual(['message', 'returnCode']);
  expect(res.body.returnCode).toBe(res.status);
  expect(typeof res.body.message).toBe('string');
};

describe('error envelope (INV-HTTP-001)', () => {
  it('401 (no auth) → uniform envelope', async () => {
    const res = await request(ctx.server).get('/v1/veiculos/placa/ABC1D23');
    assertEnvelope(res, 401);
  });

  it('404 (absent placa) → uniform envelope', async () => {
    const res = await request(ctx.server)
      .get('/v1/veiculos/placa/ZZZ9Z99')
      .set(AUTH);
    assertEnvelope(res, 404);
  });

  it('402 (magic key ERR2A02) → uniform envelope', async () => {
    const res = await request(ctx.server)
      .get('/v1/veiculos/placa/ERR2A02')
      .set(AUTH);
    assertEnvelope(res, 402);
  });

  it('500 (magic key ERR5A00) → uniform envelope', async () => {
    const res = await request(ctx.server)
      .get('/v1/veiculos/placa/ERR5A00')
      .set(AUTH);
    assertEnvelope(res, 500);
  });
});
