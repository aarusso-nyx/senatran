import { describe, expect, it } from 'vitest';
import { RenachService } from './renach.service.js';
import { TransactionSupport } from '../../../shared/api/src/common/transaction-support.service.js';
import { DatabaseStub } from '../../../../tests/utils/database.stub.js';

type Rows = (sql: string) => { rows: unknown[] };
const make = (rows: Rows) => {
  const db = new DatabaseStub();
  db.handler = (sql) => rows(sql);
  return { db, svc: new RenachService(db, new TransactionSupport(db)) };
};
const PROC = {
  id: 'p1',
  numero_renach: 'RS1',
  situacao: 'AGUARDANDO_MEDICO',
  tipo_processo: 'RENOVACAO',
};

describe('RenachService', () => {
  it('getProcesso → 404 when unknown', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(svc.getProcesso('RSX')).rejects.toMatchObject({
      returnCode: 404,
    });
  });

  it('consultarProcessos → 400 when cpf is missing', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(svc.consultarProcessos('')).rejects.toMatchObject({
      returnCode: 400,
    });
  });

  it('consultarProcessos → wraps active processes in { processos }', async () => {
    const { svc } = make((sql) =>
      sql.includes('from renach.processo')
        ? {
            rows: [
              {
                payload: {
                  numeroRenach: 'RS1',
                  situacao: 'AGUARDANDO_MEDICO',
                },
              },
            ],
          }
        : { rows: [] },
    );
    await expect(
      svc.consultarProcessos('52998224725', 'RENOVACAO'),
    ).resolves.toEqual({
      processos: [{ numeroRenach: 'RS1', situacao: 'AGUARDANDO_MEDICO' }],
    });
  });

  it('registrarExame → 404 when process unknown', async () => {
    const { svc } = make((sql) =>
      sql.includes('from renach.processo') ? { rows: [] } : { rows: [] },
    );
    await expect(
      svc.registrarExame('RSX', 'MEDICO', {}, 'k'),
    ).rejects.toMatchObject({ returnCode: 404 });
  });

  it('registrarExame → 402 when the examiner is not accredited', async () => {
    const { svc } = make((sql) => {
      if (sql.includes('from renach.processo')) return { rows: [PROC] };
      if (sql.includes('from renach.profissional'))
        return { rows: [{ credenciado: false, ativo: true, conselho: 'CRM' }] };
      return { rows: [] };
    });
    await expect(
      svc.registrarExame(
        'RS1',
        'MEDICO',
        { examinador: { cpf: 'x' }, exame: { resultado: 'APTO' } },
        'k',
      ),
    ).rejects.toMatchObject({ returnCode: 402 });
  });

  it('registrarExame with INAPTO rejects the process (advances to REJEITADO)', async () => {
    const { db, svc } = make((sql) =>
      sql.includes('from renach.processo') ? { rows: [PROC] } : { rows: [] },
    );
    const out = await svc.registrarExame(
      'RS1',
      'MEDICO',
      { exame: { resultado: 'INAPTO' } },
      'k',
    );
    expect(out.status).toBe(201);
    expect((out.body as { situacao: string }).situacao).toBe('REJEITADO');
    const update = db.find('update renach.processo set situacao');
    expect(update?.params).toEqual(['RS1', 'REJEITADO']);
  });

  it('registrarExame → 402 ALREADY_RECORDED when the same exam type exists', async () => {
    const { svc } = make((sql) => {
      if (sql.includes('from renach.processo')) return { rows: [PROC] };
      if (sql.includes('from renach.exame') && sql.includes('tipo_exame'))
        return { rows: [{ x: 1 }] };
      return { rows: [] };
    });
    await expect(
      svc.registrarExame(
        'RS1',
        'MEDICO',
        { exame: { resultado: 'APTO' } },
        'k',
      ),
    ).rejects.toMatchObject({ returnCode: 402 });
  });

  describe('happy paths', () => {
    const H = (sql: string): { rows: unknown[] } => {
      if (sql.includes('from audit.idempotencia')) return { rows: [] };
      if (sql.includes('from renach.processo'))
        return {
          rows: [
            {
              ...PROC,
              payload: { numeroRenach: 'RS1', situacao: PROC.situacao },
            },
          ],
        };
      if (sql.includes('v_renach_clinicas'))
        return { rows: [{ payload: [{ codigoClinica: 'C' }] }] };
      if (sql.includes('v_renach_profissionais'))
        return { rows: [{ payload: [] }] };
      if (sql.includes('v_renach_exames'))
        return { rows: [{ payload: { quantidade: 0, exames: [] } }] };
      if (
        sql.includes('update renach.agendamento') ||
        sql.includes("'CHECKIN'")
      )
        return { rows: [{ numero_renach: 'RS1' }] };
      // ALREADY_RECORDED check: no existing exam of that tipo (happy path).
      if (sql.includes('from renach.exame') && sql.includes('tipo_exame'))
        return { rows: [] };
      if (sql.includes('from renach.exame'))
        return { rows: [{ numero_renach: 'RS1' }] };
      return { rows: [] };
    };

    it('getProcesso / elegibilidade / lists', async () => {
      const { svc } = make(H);
      expect(await svc.getProcesso('RS1')).toMatchObject({
        numeroRenach: 'RS1',
      });
      expect(await svc.elegibilidade('RS1')).toMatchObject({
        numeroRenach: 'RS1',
        elegivelExameMedico: true,
      });
      expect(await svc.listClinicas()).toEqual([{ codigoClinica: 'C' }]);
      expect(await svc.listProfissionais()).toEqual([]);
      expect(await svc.listExames('RS1')).toMatchObject({ quantidade: 0 });
    });

    it('agendamento create / patch / checkin', async () => {
      const { svc } = make(H);
      const a = await svc.criarAgendamento(
        'RS1',
        { dataHora: 'x', codigoClinica: 'C' },
        'k',
      );
      expect(a.status).toBe(201);
      expect(
        await svc.patchAgendamento('id', { situacao: 'CANCELADO' }),
      ).toMatchObject({ situacao: 'CANCELADO' });
      expect(await svc.checkin('id')).toMatchObject({ situacao: 'CHECKIN' });
    });

    it('registrarExame APTO advances to EXAME_REGISTRADO', async () => {
      const { svc } = make(H);
      const out = await svc.registrarExame(
        'RS1',
        'MEDICO',
        { exame: { resultado: 'APTO' } },
        'k',
      );
      expect((out.body as { situacao: string }).situacao).toBe(
        'EXAME_REGISTRADO',
      );
    });

    it('psychological, retificação, junta encaminhamento + parecer', async () => {
      const { svc } = make(H);
      expect(
        (
          await svc.registrarExame(
            'RS1',
            'PSICOLOGICO',
            { avaliacao: { resultado: 'APTO' } },
            'k',
          )
        ).status,
      ).toBe(201);
      expect((await svc.retificarExame('id', {})).status).toBe(202);
      expect((await svc.encaminharJunta('RS1', {})).status).toBe(202);
      const p = await svc.registrarParecerJunta('RS1', { resultado: 'APTO' });
      expect((p.body as { situacao: string }).situacao).toBe('APROVADO');
    });
  });
});
