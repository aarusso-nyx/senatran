import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createE2eApp, AUTH, type TestApp } from '../utils/e2e-app.js';

/**
 * INV-RENACH-001 — RENACH process read, reference lists, an idempotent exam
 * registration, and the NOT_FOUND envelope. Assumes a fresh `pnpm db:reset`
 * (process RS123456789 seeded at AGUARDANDO_MEDICO).
 */
let ctx: TestApp;
beforeAll(async () => {
  ctx = await createE2eApp();
});
afterAll(async () => {
  await ctx.close();
});

const PROC = 'RS123456789';
// A seeded, credentialed CRM professional (medical exam requires conselho CRM).
const EXAMINADOR_CPF = '36316618603';

describe('renach workflow (INV-RENACH-001)', () => {
  it('GET processo → 200 with string situacao', async () => {
    const res = await request(ctx.server)
      .get(`/v1/renach/processos/${PROC}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(typeof res.body.situacao).toBe('string');
  });

  it('GET clinicasCredenciadas → 200 array', async () => {
    const res = await request(ctx.server)
      .get('/v1/renach/clinicasCredenciadas')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET profissionaisCredenciados → 200 array', async () => {
    const res = await request(ctx.server)
      .get('/v1/renach/profissionaisCredenciados')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  const validExame = () => ({
    idAgendamento: 'appt-e2e-1',
    clinica: { codigoClinica: 'RS-CLINIC-0001', cnpj: '11444777000161' },
    examinador: {
      cpf: EXAMINADOR_CPF,
      conselho: 'CRM',
      numeroConselho: '12345',
      uf: 'RS',
    },
    condutor: {
      cpf: '52998224725',
      nome: 'Fulano',
      dataNascimento: '1985-03-14',
    },
    processo: { numeroRenach: PROC, tipoProcesso: 'RENOVACAO' },
    exame: { dataRealizacao: '2026-07-10T09:30:00Z', resultado: 'APTO' },
  });

  it('POST examesMedicos with an incomplete body → 400', async () => {
    const res = await request(ctx.server)
      .post(`/v1/renach/processos/${PROC}/examesMedicos`)
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .send({ exame: { resultado: 'APTO' } });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ returnCode: 400 });
  });

  it('POST examesMedicos is idempotent for the same Idempotency-Key', async () => {
    const key = `e2e-exame-${Date.now()}`;
    const body = validExame();
    const first = await request(ctx.server)
      .post(`/v1/renach/processos/${PROC}/examesMedicos`)
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', key)
      .send(body);
    expect(first.status).toBe(201);
    expect(typeof first.body.idExame).toBe('string');

    const replay = await request(ctx.server)
      .post(`/v1/renach/processos/${PROC}/examesMedicos`)
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', key)
      .send(body);
    expect(replay.status).toBe(first.status);
    expect(replay.body.idExame).toBe(first.body.idExame);
    expect(replay.body).toEqual(first.body);
  });

  it('GET unknown processo → 404 RENACH.PROCESS.NOT_FOUND', async () => {
    const res = await request(ctx.server)
      .get('/v1/renach/processos/UNKNOWN999')
      .set(AUTH);
    expect(res.status).toBe(404);
    expect(res.body.message).toContain('RENACH.PROCESS.NOT_FOUND');
  });
});
