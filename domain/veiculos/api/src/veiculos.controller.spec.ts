import { describe, expect, it, beforeEach } from 'vitest';
import { VeiculosController } from './veiculos.controller.js';
import type { ReadService } from '../../../shared/api/src/common/read.service.js';

let last: {
  fn: 'one' | 'list';
  target: string;
  keys: unknown;
  cursor?: string;
};
const read = {
  one: async (view: string, keys?: unknown) => (
    (last = { fn: 'one', target: view, keys }),
    { view, keys }
  ),
  list: async (table: string, keys: unknown, cursor?: string) => (
    (last = { fn: 'list', target: table, keys, cursor }),
    { table, keys }
  ),
} as unknown as ReadService;
const c = new VeiculosController(read);

beforeEach(() => {
  last = { fn: 'one', target: '', keys: undefined };
});

describe('VeiculosController delegates to the right seam + keys', () => {
  it('byPlaca → list over the veiculo base table', async () => {
    await c.byPlaca('ABC1D23', '10');
    expect(last).toEqual({
      fn: 'list',
      target: 'veiculo',
      keys: { placa: 'ABC1D23' },
      cursor: '10',
    });
  });
  it('byRenavam maps to codigo_renavam (list)', async () => {
    await c.byRenavam('123');
    expect(last).toMatchObject({
      fn: 'list',
      target: 'veiculo',
      keys: { codigo_renavam: '123' },
    });
  });
  it('proprietario cnpj+chassi+renavam → single object view', async () => {
    await c.byProprietarioCnpjChassiRenavam('CNPJ', 'CH', 'RN');
    expect(last).toEqual({
      fn: 'one',
      target: 'v_veiculo_by_proprietario_cnpj_chassi_renavam',
      keys: { id_proprietario: 'CNPJ', chassi: 'CH', codigo_renavam: 'RN' },
    });
  });
  it('comunicacaoVenda cpf → object view', async () => {
    await c.comunicacaoVendaCpf('C', 'R', 'P');
    expect(last).toEqual({
      fn: 'one',
      target: 'v_comunicacao_venda_by_cpf',
      keys: { cpf: 'C', renavam: 'R', placa: 'P' },
    });
  });
  it('recall by chassi → object view', async () => {
    await c.recall('CH');
    expect(last).toEqual({
      fn: 'one',
      target: 'v_veiculo_recall_by_chassi',
      keys: { chassi: 'CH' },
    });
  });
  it('every method resolves without throwing', async () => {
    await Promise.all([
      c.byChassi('x'),
      c.byMotor('x'),
      c.byCambio('x'),
      c.byProprietarioCpf('x'),
      c.byProprietarioCnpj('x'),
      c.byProprietarioCpfChassiRenavam('a', 'b', 'c'),
      c.byProprietarioCpfPlacaRenavam('a', 'b', 'c'),
      c.byProprietarioCnpjPlacaRenavam('a', 'b', 'c'),
      c.csvByCpf('a', 'b', 'c'),
      c.csvByCnpj('a', 'b', 'c'),
      c.comunicacaoVendaCnpj('a', 'b', 'c'),
      c.multaCpf('a', 'b', 'c'),
      c.multaCnpj('a', 'b', 'c'),
      c.enderecoPossuidorPlaca('a'),
      c.enderecoPossuidorPlacaRenavam('a', 'b'),
    ]);
    expect(true).toBe(true);
  });
});
