import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createE2eApp, AUTH, type TestApp } from '../utils/e2e-app.js';

/** Real cursor pagination via the idUltimoRegistro query param. */
let ctx: TestApp;
beforeAll(async () => {
  ctx = await createE2eApp();
});
afterAll(async () => {
  await ctx.close();
});
const get = (path: string) => request(ctx.server).get(path).set(AUTH);

describe('cursor pagination (idUltimoRegistro)', () => {
  it('veiculos list carries the envelope + a cursor', async () => {
    const res = await get('/v1/veiculos/placa/ABC1D23');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'idUltimoRegistro',
      'quantidadeVeiculo',
      'quantidadeVeiculoReal',
      'veiculo',
    ]);
    expect(res.body.quantidadeVeiculo).toBe(1);
    expect(res.body.veiculo).toHaveLength(1);
  });

  it('paging past the last id yields an empty page (still 200, real count preserved)', async () => {
    const first = await get('/v1/veiculos/placa/ABC1D23');
    const cursor = first.body.idUltimoRegistro;
    const next = await get(
      `/v1/veiculos/placa/ABC1D23?idUltimoRegistro=${cursor}`,
    );
    expect(next.status).toBe(200);
    expect(next.body.quantidadeVeiculo).toBe(0);
    expect(next.body.quantidadeVeiculoReal).toBe(1);
    expect(next.body.veiculo).toEqual([]);
  });

  it('an owner with multiple vehicles reports the real total', async () => {
    // The fixture CPF owns ABC1D23 and IND1I01.
    const res = await get('/v1/veiculos/proprietario/cpf/52998224725');
    expect(res.status).toBe(200);
    expect(res.body.quantidadeVeiculoReal).toBeGreaterThanOrEqual(2);
    expect(res.body.veiculo.length).toBe(res.body.quantidadeVeiculo);
  });

  it('a well-formed but absent identifier is 404, not an empty list', async () => {
    const res = await get('/v1/veiculos/placa/ZZZ9Z99');
    expect(res.status).toBe(404);
  });
});
