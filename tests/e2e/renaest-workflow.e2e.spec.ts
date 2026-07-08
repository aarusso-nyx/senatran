import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createE2eApp, AUTH, type TestApp } from '../utils/e2e-app.js';

/**
 * INV-RENAEST-001 — national crash/sinister base: submit, read-back (by id and
 * protocol), idempotent replay, and the layout/completeness/duplicate/terminal
 * business rules + the forced-500 magic key. Assumes a fresh `pnpm db:reset`
 * (crash SN00000000001 seeded RECEBIDO, SN00000000005 terminal REJEITADO).
 */
let ctx: TestApp;
beforeAll(async () => {
  ctx = await createE2eApp();
});
afterAll(async () => {
  await ctx.close();
});

const RESERVED_CPF = '00000000000';
const ACEITO = 'SN00000000001';
const REJEITADO = 'SN00000000005';

// A unique-per-run body so the natural-dedup key does not collide across runs.
const novoSinistro = (over: Record<string, unknown> = {}) => ({
  dataHoraSinistro: new Date(
    Date.UTC(2024, 5, 1, 0, 0, Number(String(Date.now()).slice(-6)) % 60),
  ).toISOString(),
  uf: 'SP',
  codigoMunicipio: '3550308',
  gravidade: 'SEM_VITIMA',
  local: 'KM 42 - rodovia estadual',
  orgaoResponsavel: 'DETRAN-SP-E2E-' + String(Date.now()).slice(-7),
  condicoesVia: 'SECA',
  condicoesMeteorologicas: 'BOM',
  ...over,
});

describe('renaest workflow (INV-RENAEST-001)', () => {
  it('requires x-cpf-usuario on the surface', async () => {
    const res = await request(ctx.server).get(
      `/v1/renaest/sinistros/${ACEITO}`,
    );
    expect(res.status).toBe(401);
    expect(res.body.returnCode).toBe(401);
  });

  it('rejects the reserved CPF with 401', async () => {
    const res = await request(ctx.server)
      .get(`/v1/renaest/sinistros/${ACEITO}`)
      .set({ ...AUTH, 'x-cpf-usuario': RESERVED_CPF });
    expect(res.status).toBe(401);
  });

  it('GET a seeded crash → 200 with string situacao', async () => {
    const res = await request(ctx.server)
      .get(`/v1/renaest/sinistros/${ACEITO}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.idSinistro).toBe(ACEITO);
    expect(res.body.situacao).toBe('RECEBIDO');
  });

  it('GET by protocol → 200, same record', async () => {
    const byId = await request(ctx.server)
      .get(`/v1/renaest/sinistros/${ACEITO}`)
      .set(AUTH);
    const res = await request(ctx.server)
      .get(`/v1/renaest/protocolos/${byId.body.protocolo}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.idSinistro).toBe(ACEITO);
  });

  it('GET unknown crash → 404 envelope', async () => {
    const res = await request(ctx.server)
      .get('/v1/renaest/sinistros/SN99999999999')
      .set(AUTH);
    expect(res.status).toBe(404);
    expect(res.body.message).toContain('RENAEST.CRASH.NOT_FOUND');
  });

  it('POST a crash → 201 with minted id + protocolo', async () => {
    const res = await request(ctx.server)
      .post('/v1/renaest/sinistros')
      .set(AUTH)
      .send(novoSinistro());
    expect(res.status).toBe(201);
    expect(typeof res.body.idSinistro).toBe('string');
    expect(res.body.situacao).toBe('RECEBIDO');
  });

  it('POST is idempotent under the same Idempotency-Key', async () => {
    const body = novoSinistro();
    const key = 'e2e-renaest-' + Date.now();
    const first = await request(ctx.server)
      .post('/v1/renaest/sinistros')
      .set(AUTH)
      .set('Idempotency-Key', key)
      .send(body);
    const replay = await request(ctx.server)
      .post('/v1/renaest/sinistros')
      .set(AUTH)
      .set('Idempotency-Key', key)
      .send(body);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body.idSinistro).toBe(first.body.idSinistro);
  });

  it('a same-tuple resubmit without a key → 402 DUPLICATED', async () => {
    const body = novoSinistro();
    await request(ctx.server)
      .post('/v1/renaest/sinistros')
      .set(AUTH)
      .send(body);
    const dup = await request(ctx.server)
      .post('/v1/renaest/sinistros')
      .set(AUTH)
      .send(body);
    expect(dup.status).toBe(402);
    expect(dup.body.message).toContain('RENAEST.CRASH.DUPLICATED');
  });

  it('unsupported versaoLeiaute → 400 INVALID_LAYOUT', async () => {
    const res = await request(ctx.server)
      .post('/v1/renaest/sinistros')
      .set(AUTH)
      .send(novoSinistro({ versaoLeiaute: '9.9' }));
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('RENAEST.CRASH.INVALID_LAYOUT');
  });

  it('victim crash with no vitimas → 402 INCOMPLETE_DATA', async () => {
    const res = await request(ctx.server)
      .post('/v1/renaest/sinistros')
      .set(AUTH)
      .send(novoSinistro({ gravidade: 'COM_VITIMA_FATAL', vitimas: [] }));
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('RENAEST.CRASH.INCOMPLETE_DATA');
  });

  it('correction on a terminal record → 402 CORRECTION_NOT_ALLOWED', async () => {
    const res = await request(ctx.server)
      .post(`/v1/renaest/sinistros/${REJEITADO}/correcoes`)
      .set(AUTH)
      .send({ motivo: 'ajuste' });
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('RENAEST.CRASH.CORRECTION_NOT_ALLOWED');
  });

  it('complement on an accepted record → 202', async () => {
    const res = await request(ctx.server)
      .post(`/v1/renaest/sinistros/${ACEITO}/complementos`)
      .set(AUTH)
      .send({ motivo: 'dado complementar' });
    expect(res.status).toBe(202);
    expect(res.body.situacao).toBe('RETIFICACAO_EM_ANALISE');
  });

  it('batch submit → 201 with itens', async () => {
    const res = await request(ctx.server)
      .post('/v1/renaest/sinistros/lotes')
      .set(AUTH)
      .send({
        sinistros: [
          novoSinistro(),
          novoSinistro({ uf: 'RJ', codigoMunicipio: '3304557' }),
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.quantidade).toBe(2);
    expect(res.body.itens).toHaveLength(2);
  });

  it('codigoMunicipio magic key → forced 500', async () => {
    const res = await request(ctx.server)
      .post('/v1/renaest/sinistros')
      .set(AUTH)
      .send(novoSinistro({ codigoMunicipio: '9999999' }));
    expect(res.status).toBe(500);
    expect(res.body.returnCode).toBe(500);
  });
});
