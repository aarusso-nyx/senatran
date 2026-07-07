import { describe, expect, it } from 'vitest';
import { ReadService } from './read.service.js';
import { ScenarioService } from './scenario.service.js';
import { WsdenatranError } from './wsdenatran-error.js';
import { DatabaseStub } from '../../../../../tests/utils/database.stub.js';

function make(
  scenarioForced: { status: number; message: string } | null = null,
) {
  const db = new DatabaseStub();
  const scenario = {
    forced: async () => scenarioForced,
    certAllowed: async () => true,
  } as unknown as ScenarioService;
  return { db, service: new ReadService(db, scenario) };
}

describe('ReadService', () => {
  it('returns the payload of the matching row', async () => {
    const { db, service } = make();
    db.handler = () => ({ rows: [{ payload: { placa: 'ABC1D23' } }] });
    const out = await service.one('v_veiculo_by_placa', { placa: 'ABC1D23' });
    expect(out).toEqual({ placa: 'ABC1D23' });
  });

  it('builds a parameterized WHERE from the keys', async () => {
    const { db, service } = make();
    db.handler = () => ({ rows: [{ payload: {} }] });
    await service.one('v_x', { placa: 'AAA0A00', codigo_renavam: '123' });
    const call = db.calls[db.calls.length - 1];
    expect(call.sql).toContain(
      'from contract.v_x where placa = $1 and codigo_renavam = $2',
    );
    expect(call.params).toEqual(['AAA0A00', '123']);
  });

  it('throws 404 when no row matches', async () => {
    const { service } = make();
    await expect(service.one('v_x', { placa: 'NOPE' })).rejects.toMatchObject({
      returnCode: 404,
    });
  });

  it('honors a forced scenario key before querying (no DB call)', async () => {
    const { db, service } = make({ status: 402, message: 'CODE — boom' });
    await expect(
      service.one('v_veiculo_by_placa', { placa: 'ERR2A02' }),
    ).rejects.toBeInstanceOf(WsdenatranError);
    await expect(
      service.one('v_veiculo_by_placa', { placa: 'ERR2A02' }),
    ).rejects.toMatchObject({ returnCode: 402 });
    expect(db.calls).toHaveLength(0);
  });

  it('supports keyless views (static list)', async () => {
    const { db, service } = make();
    db.handler = () => ({ rows: [{ payload: [1, 2, 3] }] });
    const out = await service.one('v_alteracoes_permitidas');
    expect(out).toEqual([1, 2, 3]);
    expect(db.calls[0].sql).not.toContain('where');
  });

  describe('list() pagination', () => {
    it('builds the veiculo envelope with returned/real counts + cursor', async () => {
      const { service, db } = make();
      db.handler = (sql) =>
        sql.includes('count(*)')
          ? { rows: [{ n: 3 }] }
          : {
              rows: [
                { id: 5, payload: { a: 1 } },
                { id: 9, payload: { a: 2 } },
              ],
            };
      const out = await service.list('veiculo', { placa: 'ABC1D23' });
      expect(out).toEqual({
        quantidadeVeiculo: 2,
        quantidadeVeiculoReal: 3,
        idUltimoRegistro: 9,
        veiculo: [{ a: 1 }, { a: 2 }],
      });
    });

    it('404s when the total count is zero', async () => {
      const { service, db } = make();
      db.handler = () => ({ rows: [{ n: 0 }] });
      await expect(
        service.list('veiculo', { placa: 'X' }),
      ).rejects.toMatchObject({ returnCode: 404 });
    });

    it('adds an id > cursor clause when a cursor is given', async () => {
      const { service, db } = make();
      db.handler = (sql) =>
        sql.includes('count(*)')
          ? { rows: [{ n: 1 }] }
          : { rows: [{ id: 12, payload: {} }] };
      await service.list('infracao', { cpf: '1' }, '7');
      const page = db.find('order by id');
      expect(page?.sql).toContain('id > $2');
      expect(page?.params).toEqual(['1', 7]);
    });

    it('applies forced scenario keys before querying', async () => {
      const { service, db } = make({ status: 402, message: 'X' });
      await expect(
        service.list('veiculo', { placa: 'ERR2A02' }),
      ).rejects.toMatchObject({ returnCode: 402 });
      expect(db.calls).toHaveLength(0);
    });
  });
});
