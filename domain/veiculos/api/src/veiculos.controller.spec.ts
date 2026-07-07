import { describe, expect, it, beforeEach } from 'vitest';
import { VeiculosController } from './veiculos.controller.js';
import type { ReadService } from '../../../shared/api/src/common/read.service.js';

let last: { view: string; keys: unknown };
const read = {
  one: async (view: string, keys?: unknown) => (
    (last = { view, keys }),
    { view, keys }
  ),
} as unknown as ReadService;
const c = new VeiculosController(read);

beforeEach(() => {
  last = { view: '', keys: undefined };
});

describe('VeiculosController delegates to the right view + keys', () => {
  it('byPlaca', async () => {
    await c.byPlaca('ABC1D23');
    expect(last).toEqual({
      view: 'v_veiculo_by_placa',
      keys: { placa: 'ABC1D23' },
    });
  });
  it('byRenavam maps to codigo_renavam', async () => {
    await c.byRenavam('123');
    expect(last).toEqual({
      view: 'v_veiculo_by_renavam',
      keys: { codigo_renavam: '123' },
    });
  });
  it('proprietario cnpj+chassi+renavam maps cnpj→id_proprietario', async () => {
    await c.byProprietarioCnpjChassiRenavam('CNPJ', 'CH', 'RN');
    expect(last).toEqual({
      view: 'v_veiculo_by_proprietario_cnpj_chassi_renavam',
      keys: { id_proprietario: 'CNPJ', chassi: 'CH', codigo_renavam: 'RN' },
    });
  });
  it('comunicacaoVenda cpf', async () => {
    await c.comunicacaoVendaCpf('C', 'R', 'P');
    expect(last).toEqual({
      view: 'v_comunicacao_venda_by_cpf',
      keys: { cpf: 'C', renavam: 'R', placa: 'P' },
    });
  });
  it('recall by chassi', async () => {
    await c.recall('CH');
    expect(last).toEqual({
      view: 'v_veiculo_recall_by_chassi',
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
