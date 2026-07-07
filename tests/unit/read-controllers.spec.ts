import { describe, expect, it } from 'vitest';
import type { ReadService } from '../../domain/shared/api/src/common/read.service.js';
import { CondutoresController } from '../../domain/condutores/api/src/condutores.controller.js';
import { InfracoesController } from '../../domain/infracoes/api/src/infracoes.controller.js';
import { IndicadoresController } from '../../domain/indicadores/api/src/indicadores.controller.js';
import { RestricoesJudiciaisController } from '../../domain/restricoes-judiciais/api/src/restricoes-judiciais.controller.js';
import { RouboFurtoController } from '../../domain/roubo-furto/api/src/roubo-furto.controller.js';
import { ConsultaCsvController } from '../../domain/consulta-csv/api/src/consulta-csv.controller.js';
import { AutorizacoesController } from '../../domain/autorizacoes/api/src/autorizacoes.controller.js';

/** A recording ReadService that returns the (view, keys) it was called with. */
function recorder() {
  const calls: { view: string; keys: unknown }[] = [];
  const read = {
    one: async (view: string, keys?: unknown) => (
      calls.push({ view, keys }),
      { view, keys }
    ),
  } as unknown as ReadService;
  return { read, calls };
}

describe('read controllers delegate to ReadService', () => {
  it('condutores — all 12 endpoints', async () => {
    const { read, calls } = recorder();
    const c = new CondutoresController(read);
    await c.byCpf('1');
    await c.byCpfRegistroCnh('1', '2');
    await c.byFormularioRenach('1');
    await c.imagens('1', '2', '3');
    await c.byImpedimento('1');
    await c.infracoesByRegistroCnh('1');
    await c.byDadosIdentificatorios('a', 'b', 'c');
    await c.byPgu('1');
    await c.byPid('1');
    await c.byRegistroCnh('1');
    await c.retrato('1', '2', '3');
    await c.validacao('1', '2', '3');
    expect(calls).toHaveLength(12);
    expect(calls[0]).toMatchObject({
      view: 'v_condutores_by_cpf',
      keys: { cpf: '1' },
    });
  });

  it('infracoes — all 10 endpoints', async () => {
    const { read, calls } = recorder();
    const c = new InfracoesController(read);
    await c.byAit('a', 'o', 'i');
    await c.byCnpj('1');
    await c.byCpf('1');
    await c.byHabilitacaoEstrangeira('1');
    await c.ocorrenciasByAit('a', 'o', 'i');
    await c.pagamentosByAit('a', 'o', 'i');
    await c.byPguUf('p', 'u');
    await c.byPlacaExigibilidade('p', 'e');
    await c.byRegistroCnh('1');
    await c.byRenainf('1');
    expect(calls).toHaveLength(10);
  });

  it('indicadores — all 8 endpoints', async () => {
    const { read, calls } = recorder();
    const c = new IndicadoresController(read);
    await c.alarmeByChassi('1');
    await c.alarmeByPlaca('1');
    await c.restricaoJudicialByChassi('1');
    await c.restricaoJudicialByPlaca('1');
    await c.rouboFurtoByChassi('1');
    await c.rouboFurtoByPlaca('1');
    await c.sinistroByChassi('1');
    await c.sinistroByPlaca('1');
    expect(calls).toHaveLength(8);
  });

  it('restricoes-judiciais, roubo-furto, consulta-csv, autorizacoes', async () => {
    const { read, calls } = recorder();
    await new RestricoesJudiciaisController(read).byPlaca('1');
    await new RestricoesJudiciaisController(read).byPlacaRenavam('1', '2');
    await new RouboFurtoController(read).emAbertoByChassi('1');
    await new RouboFurtoController(read).emAbertoByPlaca('1');
    await new ConsultaCsvController(read).byChassi('1');
    await new ConsultaCsvController(read).byPlaca('1');
    await new AutorizacoesController(read).alteracoesPermitidas();
    expect(calls).toHaveLength(7);
    expect(calls[6]).toMatchObject({ view: 'v_alteracoes_permitidas' });
  });
});
