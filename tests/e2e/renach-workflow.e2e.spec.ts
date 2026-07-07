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

  // Derive a valid examiner + clinic from the live read endpoints so the body
  // stays correct regardless of which credentialed rows the seed produced.
  const validExame = async () => {
    const clinicas = (
      await request(ctx.server).get('/v1/renach/clinicasCredenciadas').set(AUTH)
    ).body as Array<{ codigoClinica: string; cnpj: string }>;
    const profs = (
      await request(ctx.server)
        .get('/v1/renach/profissionaisCredenciados')
        .set(AUTH)
    ).body as Array<{ cpf: string; conselho: string; uf: string }>;
    const clinica = clinicas[0];
    const examinador = profs.find((p) => p.conselho === 'CRM');
    expect(clinica, 'seed must have a credentialed clinic').toBeTruthy();
    expect(
      examinador,
      'seed must have a credentialed CRM examiner',
    ).toBeTruthy();
    return {
      idAgendamento: 'appt-e2e-1',
      clinica: { codigoClinica: clinica.codigoClinica, cnpj: clinica.cnpj },
      examinador: {
        cpf: examinador!.cpf,
        conselho: 'CRM',
        numeroConselho: '12345',
        uf: examinador!.uf,
      },
      condutor: {
        cpf: '52998224725',
        nome: 'Fulano',
        dataNascimento: '1985-03-14',
      },
      processo: { numeroRenach: PROC, tipoProcesso: 'RENOVACAO' },
      exame: { dataRealizacao: '2026-07-10T09:30:00Z', resultado: 'APTO' },
    };
  };

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
    const body = await validExame();
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

// Opening a new RENACH process (POST /v1/renach/processos) — the entry point
// pec needs to open a process per candidate and continue the lifecycle.
describe('renach process opening (INV-RENACH-001)', () => {
  const openBody = (cpf: string) => ({
    cpf,
    tipoProcesso: 'RENOVACAO',
    categoriaAtual: 'B',
    categoriaPretendida: 'B',
  });

  it('POST processos → 201 ABERTO with a fresh numeroRenach, then flows on', async () => {
    const cpf = `9${Date.now().toString().slice(-10)}`;
    const res = await request(ctx.server)
      .post('/v1/renach/processos')
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .send(openBody(cpf));
    expect(res.status).toBe(201);
    expect(res.body.situacao).toBe('ABERTO');
    expect(res.body.numeroRenach).toMatch(/^RN\d{11}$/);

    const numero = res.body.numeroRenach;
    // the minted process is readable...
    const get = await request(ctx.server)
      .get(`/v1/renach/processos/${numero}`)
      .set(AUTH);
    expect(get.status).toBe(200);
    // ...and the existing lifecycle continues from ABERTO.
    const elig = await request(ctx.server)
      .post(`/v1/renach/processos/${numero}/elegibilidadeExame`)
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .send({ tipoProcesso: 'RENOVACAO' });
    expect(elig.status).toBe(200);
    expect(elig.body.elegivelExameMedico).toBe(true);
  });

  it('second open for the same cpf+tipo → 402 RENACH.PROCESS.ALREADY_OPEN', async () => {
    const cpf = `9${Date.now().toString().slice(-10)}`;
    const first = await request(ctx.server)
      .post('/v1/renach/processos')
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .send(openBody(cpf));
    expect(first.status).toBe(201);
    const dup = await request(ctx.server)
      .post('/v1/renach/processos')
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .send(openBody(cpf));
    expect(dup.status).toBe(402);
    expect(dup.body.message).toContain('RENACH.PROCESS.ALREADY_OPEN');
  });

  it('same Idempotency-Key replays the original open (no duplicate)', async () => {
    const cpf = `9${Date.now().toString().slice(-10)}`;
    const key = `e2e-abre-${Date.now()}`;
    const first = await request(ctx.server)
      .post('/v1/renach/processos')
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', key)
      .send(openBody(cpf));
    const replay = await request(ctx.server)
      .post('/v1/renach/processos')
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', key)
      .send(openBody(cpf));
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body.numeroRenach).toBe(first.body.numeroRenach);
  });

  it('missing cpf → 400 (DTO validation)', async () => {
    const res = await request(ctx.server)
      .post('/v1/renach/processos')
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .send({ tipoProcesso: 'RENOVACAO' });
    expect(res.status).toBe(400);
  });
});
