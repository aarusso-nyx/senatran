import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createE2eApp, AUTH, type TestApp } from '../utils/e2e-app.js';

/**
 * Coverage sweep: at least one endpoint from each of the 8 WSDenatran read
 * groups, hit with stable seed fixtures, asserting 200 + a key envelope field.
 */
let ctx: TestApp;
beforeAll(async () => {
  ctx = await createE2eApp();
});
afterAll(async () => {
  await ctx.close();
});

const get = (path: string) => request(ctx.server).get(path).set(AUTH);

describe('read sweep — veiculos', () => {
  it('placa ABC1D23 → 200 + envelope shape', async () => {
    const res = await get('/v1/veiculos/placa/ABC1D23');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'idUltimoRegistro',
      'quantidadeVeiculo',
      'quantidadeVeiculoReal',
      'veiculo',
    ]);
    expect(res.body.veiculo[0].placa).toBe('ABC1D23');
  });

  it('chassi 9BWZZZ377VT004251 resolves to ABC1D23', async () => {
    const res = await get('/v1/veiculos/chassi/9BWZZZ377VT004251');
    expect(res.status).toBe(200);
    expect(res.body.veiculo[0].placa).toBe('ABC1D23');
  });

  it('renavam 00123456780 → 200', async () => {
    const res = await get('/v1/veiculos/renavam/00123456780');
    expect(res.status).toBe(200);
    expect(res.body.veiculo[0].placa).toBe('ABC1D23');
  });

  it('proprietario cnpj 11444777000161 → 200', async () => {
    const res = await get('/v1/veiculos/proprietario/cnpj/11444777000161');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.veiculo)).toBe(true);
  });
});

describe('read sweep — condutores', () => {
  it('cpf 52998224725 → condutores is array', async () => {
    const res = await get('/v1/condutores/cpf/52998224725');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.condutores)).toBe(true);
  });
});

describe('read sweep — infracoes', () => {
  it('cpf 52998224725 → quantidadeInfracoes is number', async () => {
    const res = await get('/v1/infracoes/cpf/52998224725');
    expect(res.status).toBe(200);
    expect(typeof res.body.quantidadeInfracoes).toBe('number');
  });
});

describe('read sweep — indicadores', () => {
  it('alarme/placa/IND1I01 → true', async () => {
    const res = await get('/v1/indicadores/alarme/placa/IND1I01');
    expect(res.status).toBe(200);
    // Handler returns a raw JSON boolean; Nest serializes it as a primitive, so
    // supertest exposes it via res.text (res.body is {} for non-object JSON).
    expect(res.text).toBe('true');
  });

  it('alarme/placa/ABC1D23 → false', async () => {
    const res = await get('/v1/indicadores/alarme/placa/ABC1D23');
    expect(res.status).toBe(200);
    expect(res.text).toBe('false');
  });

  it('restricaoJudicial/placa/ABC1D23 → has indicadorPenhora', async () => {
    const res = await get('/v1/indicadores/restricaoJudicial/placa/ABC1D23');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('indicadorPenhora');
  });

  it('sinistro/placa/ABC1D23 → 3 flags', async () => {
    const res = await get('/v1/indicadores/sinistro/placa/ABC1D23');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toHaveLength(3);
  });
});

describe('read sweep — ConsultaCSV', () => {
  it('placa/ABC1D23 → 200', async () => {
    const res = await get('/v1/ConsultaCSV/placa/ABC1D23');
    expect(res.status).toBe(200);
  });
});

describe('read sweep — restricoesJudiciaisAtivas', () => {
  it('placa/IND1I01 → 200', async () => {
    const res = await get('/v1/restricoesJudiciaisAtivas/placa/IND1I01');
    expect(res.status).toBe(200);
  });
});

describe('read sweep — rouboFurto', () => {
  it('emAberto/placa/IND1I01 → 200', async () => {
    const res = await get('/v1/rouboFurto/emAberto/placa/IND1I01');
    expect(res.status).toBe(200);
  });
});

describe('read sweep — autorizacoesAlteracaoVeiculo', () => {
  it('alteracoesPermitidas → array length 5', async () => {
    const res = await get(
      '/v1/autorizacoesAlteracaoVeiculo/alteracoesPermitidas',
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(5);
  });
});
