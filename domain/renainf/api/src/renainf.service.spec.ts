import { describe, expect, it } from 'vitest';
import { RenainfService } from './renainf.service.js';
import { TransactionSupport } from '../../../shared/api/src/common/transaction-support.service.js';
import { DatabaseStub } from '../../../../tests/utils/database.stub.js';

type Rows = (sql: string) => { rows: unknown[] };
const make = (rows: Rows) => {
  const db = new DatabaseStub();
  db.handler = (sql) => rows(sql);
  return { db, svc: new RenainfService(db, new TransactionSupport(db)) };
};
const AIT = {
  numeroAit: 'A1',
  codigoOrgaoAutuador: '1',
  infracao: { codigoInfracao: '74550' },
  veiculo: { placa: 'ABC1D23' },
};
const proc = (situacao: string) => ({ id: 'c1', situacao });

describe('RenainfService', () => {
  it('criarAit → 400 when numeroAit is missing', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(
      svc.criarAit({ infracao: { codigoInfracao: '1' } }),
    ).rejects.toMatchObject({ returnCode: 400 });
  });

  it('criarAit → 400 when the infraction code is missing', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(svc.criarAit({ numeroAit: 'A1' })).rejects.toMatchObject({
      returnCode: 400,
    });
  });

  it('criarAit → 402 DUPLICATED for an existing AIT', async () => {
    const { svc } = make((sql) =>
      sql.includes('select 1 from renainf.ait')
        ? { rows: [{ '?column?': 1 }] }
        : { rows: [] },
    );
    await expect(svc.criarAit(AIT, 'k')).rejects.toMatchObject({
      returnCode: 402,
    });
  });

  it('criarAit → 201 VALIDADO on success', async () => {
    const { svc } = make(() => ({ rows: [] }));
    const out = await svc.criarAit(AIT, 'k');
    expect(out.status).toBe(201);
    expect((out.body as { situacao: string }).situacao).toBe('VALIDADO');
  });

  it('imporPenalidade → 402 CASE.INVALID_STATUS before the defense phase', async () => {
    const { svc } = make((sql) =>
      sql.includes('from renainf.processo')
        ? { rows: [proc('AUTUACAO_ABERTA')] }
        : { rows: [] },
    );
    await expect(svc.imporPenalidade('c1', {}, 'k')).rejects.toMatchObject({
      returnCode: 402,
    });
  });

  it('imporPenalidade → 402 ALREADY_IMPOSED when already penalised', async () => {
    const { svc } = make((sql) =>
      sql.includes('from renainf.processo')
        ? { rows: [proc('PENALIDADE_IMPOSTA')] }
        : { rows: [] },
    );
    await expect(svc.imporPenalidade('c1', {}, 'k')).rejects.toMatchObject({
      returnCode: 402,
    });
  });

  it('protocolarRecurso SEGUNDA_INSTANCIA → 402 without a prior JARI', async () => {
    const { svc } = make((sql) => {
      if (sql.includes('from renainf.processo'))
        return { rows: [proc('PENALIDADE_IMPOSTA')] };
      if (sql.includes('from renainf.recurso')) return { rows: [] };
      return { rows: [] };
    });
    await expect(
      svc.protocolarRecurso('c1', { instancia: 'SEGUNDA_INSTANCIA' }, 'k'),
    ).rejects.toMatchObject({ returnCode: 402 });
  });

  it('registrarPagamento → 402 ALREADY_SETTLED when the debit is settled', async () => {
    const { svc } = make((sql) => {
      if (sql.includes('from renainf.processo'))
        return { rows: [proc('PENALIDADE_IMPOSTA')] };
      if (sql.includes('from renainf.debito'))
        return { rows: [{ situacao_pagamento: 'QUITADO' }] };
      return { rows: [] };
    });
    await expect(svc.registrarPagamento('c1', {}, 'k')).rejects.toMatchObject({
      returnCode: 402,
    });
  });

  describe('happy paths', () => {
    const make2 = (situacao = 'AUTUACAO_ABERTA') =>
      make((sql) => {
        if (sql.includes('select processo_id, instancia from renainf.recurso'))
          return { rows: [{ processo_id: 'c1', instancia: 'JARI' }] };
        if (sql.includes('select id from renainf.ait'))
          return { rows: [{ id: 'aid' }] };
        if (sql.includes('select 1 from renainf.ait'))
          return { rows: [{ '?column?': 1 }] };
        if (sql.includes('from renainf.processo'))
          return { rows: [proc(situacao)] };
        if (sql.includes('from renainf.dispositivo'))
          return { rows: [{ homologado: true, ativo: true }] };
        if (sql.includes('v_renainf_ait'))
          return { rows: [{ payload: { numeroAit: 'A1' } }] };
        if (sql.includes('v_renainf_debito'))
          return { rows: [{ payload: {} }] };
        if (sql.includes('from renainf.recurso'))
          return { rows: [{ '?column?': 1 }] };
        if (sql.includes('from renainf.debito'))
          return { rows: [{ situacao_pagamento: 'EM_ABERTO' }] };
        if (sql.includes('ref_orgao_autuador'))
          return { rows: [{ payload: [] }] };
        if (sql.includes('insert into renainf.faixa_ait'))
          return { rows: [{ id: 1 }] };
        return { rows: [] };
      });

    it('talonário: dispositivo, sincronizar, faixa, lote, cancelamento', async () => {
      const { svc } = make2();
      expect(
        (await svc.registrarDispositivo({ idDispositivo: 'D1' }, 'k')).status,
      ).toBe(201);
      expect(await svc.sincronizar()).toHaveProperty('orgaosAutuadores');
      expect((await svc.reservarFaixa({})).status).toBe(201);
      expect((await svc.transmitirLote({ autos: [1, 2] })).status).toBe(202);
      expect((await svc.solicitarCancelamento('A1', {})).status).toBe(202);
      expect(await svc.getAit('A1')).toMatchObject({ numeroAit: 'A1' });
    });

    it('case lifecycle: abrir → autuacao → indicar → defesa → penalidade → notificar', async () => {
      expect(
        (await make2().svc.abrirProcesso({ numeroAit: 'A1' }, 'k')).status,
      ).toBe(201);
      expect(
        (await make2('AUTUACAO_ABERTA').svc.notificarAutuacao('c1', {})).status,
      ).toBe(201);
      expect(
        (await make2().svc.indicarCondutor('c1', { condutor: { cpf: '1' } }))
          .status,
      ).toBe(201);
      expect(
        (
          await make2('AGUARDANDO_DEFESA_PREVIA').svc.protocolarDefesa(
            'c1',
            {
              requerente: {
                tipoRequerente: 'PROPRIETARIO',
                numeroDocumento: '1',
              },
            },
            'k',
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await make2('DEFESA_APRESENTADA').svc.imporPenalidade(
            'c1',
            { valor: 100 },
            'k',
          )
        ).status,
      ).toBe(201);
      expect(
        (await make2('PENALIDADE_IMPOSTA').svc.notificarPenalidade('c1', {}))
          .status,
      ).toBe(201);
    });

    it('recurso JARI → julgamento → pagamento', async () => {
      const jari = await make2('PENALIDADE_IMPOSTA').svc.protocolarRecurso(
        'c1',
        { instancia: 'JARI' },
        'k',
      );
      expect(jari.status).toBe(201);
      expect(
        (await make2().svc.julgarRecurso('r1', { resultado: 'NEGADO' })).status,
      ).toBe(201);
      expect(await make2().svc.getDebito('c1')).toBeDefined();
      expect(
        (
          await make2('PENALIDADE_IMPOSTA').svc.registrarPagamento(
            'c1',
            { valorPago: 100 },
            'k',
          )
        ).status,
      ).toBe(201);
    });
  });
});
