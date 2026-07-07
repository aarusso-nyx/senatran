import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createE2eApp, AUTH, type TestApp } from '../utils/e2e-app.js';

/**
 * INV-AUTH-001 — every endpoint (except @Public /health) requires a well-formed
 * x-cpf-usuario plus an allowlisted x-client-cert-cn; the reserved CPF forces 401.
 */
let ctx: TestApp;
beforeAll(async () => {
  ctx = await createE2eApp();
});
afterAll(async () => {
  await ctx.close();
});

const PLACA = 'ABC1D23';

describe('auth guard (INV-AUTH-001)', () => {
  it('GET /health is public → 200 with no auth', async () => {
    const res = await request(ctx.server).get('/health');
    expect(res.status).toBe(200);
  });

  it('missing x-cpf-usuario → 401 envelope', async () => {
    const res = await request(ctx.server)
      .get(`/v1/veiculos/placa/${PLACA}`)
      .set('x-client-cert-cn', AUTH['x-client-cert-cn']);
    expect(res.status).toBe(401);
    expect(res.body.returnCode).toBe(401);
    expect(typeof res.body.message).toBe('string');
  });

  it('malformed x-cpf-usuario → 401', async () => {
    const res = await request(ctx.server)
      .get(`/v1/veiculos/placa/${PLACA}`)
      .set('x-cpf-usuario', 'abc')
      .set('x-client-cert-cn', AUTH['x-client-cert-cn']);
    expect(res.status).toBe(401);
    expect(res.body.returnCode).toBe(401);
  });

  it('valid x-cpf-usuario but bad x-client-cert-cn → 401', async () => {
    const res = await request(ctx.server)
      .get(`/v1/veiculos/placa/${PLACA}`)
      .set('x-cpf-usuario', AUTH['x-cpf-usuario'])
      .set('x-client-cert-cn', 'nope');
    expect(res.status).toBe(401);
    expect(res.body.returnCode).toBe(401);
  });

  it('reserved x-cpf-usuario 00000000000 + valid cert → 401', async () => {
    const res = await request(ctx.server)
      .get(`/v1/veiculos/placa/${PLACA}`)
      .set('x-cpf-usuario', '00000000000')
      .set('x-client-cert-cn', AUTH['x-client-cert-cn']);
    expect(res.status).toBe(401);
    expect(res.body.returnCode).toBe(401);
  });

  it('full valid AUTH → 200', async () => {
    const res = await request(ctx.server)
      .get(`/v1/veiculos/placa/${PLACA}`)
      .set(AUTH);
    expect(res.status).toBe(200);
  });
});
