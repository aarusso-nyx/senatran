import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createE2eApp, AUTH, type TestApp } from '../utils/e2e-app.js';

/**
 * INV-SCEN-001 — data-driven (existing → 200, absent → 404) and reserved magic
 * keys (ERR2A02 → 402, ERR5A00 → 500). scenarios.md is authoritative.
 */
let ctx: TestApp;
beforeAll(async () => {
  ctx = await createE2eApp();
});
afterAll(async () => {
  await ctx.close();
});

describe('scenarios (INV-SCEN-001)', () => {
  const dataDriven: Array<{ placa: string; status: number }> = [
    { placa: 'ABC1D23', status: 200 },
    { placa: 'ZZZ9Z99', status: 404 },
  ];
  it.each(dataDriven)('placa $placa → $status', async ({ placa, status }) => {
    const res = await request(ctx.server)
      .get(`/v1/veiculos/placa/${placa}`)
      .set(AUTH);
    expect(res.status).toBe(status);
  });

  it('magic 402 (ERR2A02) → message carries a domain code prefix', async () => {
    const res = await request(ctx.server)
      .get('/v1/veiculos/placa/ERR2A02')
      .set(AUTH);
    expect(res.status).toBe(402);
    // Reserved business scenario: message contains the domain code prefix.
    expect(res.body.message).toContain('RENAINF.CASE.INVALID_STATUS');
  });

  it('magic 500 (ERR5A00) → 500', async () => {
    const res = await request(ctx.server)
      .get('/v1/veiculos/placa/ERR5A00')
      .set(AUTH);
    expect(res.status).toBe(500);
    expect(res.body.returnCode).toBe(500);
  });
});
