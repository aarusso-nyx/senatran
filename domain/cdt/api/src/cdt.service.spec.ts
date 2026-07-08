import { describe, expect, it } from 'vitest';
import { CdtService } from './cdt.service.js';
import { TransactionSupport } from '../../../shared/api/src/common/transaction-support.service.js';
import { ScenarioService } from '../../../shared/api/src/common/scenario.service.js';
import { DatabaseStub } from '../../../../tests/utils/database.stub.js';

type Handler = (sql: string) => { rows: unknown[] };
type Forced = { status: number; message: string } | null;

const make = (handler: Handler, forced: Forced = null) => {
  const db = new DatabaseStub();
  db.handler = (sql) => handler(sql);
  const scenario = { forced: async () => forced } as unknown as ScenarioService;
  return { db, svc: new CdtService(db, new TransactionSupport(db), scenario) };
};

const known = (sql: string): boolean => sql.includes(') as ok');

describe('CdtService', () => {
  it('infracoes → 404 when citizen unknown', async () => {
    const { svc } = make((sql) =>
      known(sql) ? { rows: [{ ok: false }] } : { rows: [] },
    );
    await expect(svc.infracoes('00000000000')).rejects.toMatchObject({
      returnCode: 404,
    });
  });

  it('infracoes → wraps the projection when citizen known', async () => {
    const { svc } = make((sql) => {
      if (known(sql)) return { rows: [{ ok: true }] };
      if (sql.includes('from contract.v_cdt_infracao'))
        return { rows: [{ payload: { numeroAit: 'A1' } }] };
      return { rows: [] };
    });
    await expect(svc.infracoes('52998224725')).resolves.toEqual({
      cpf: '52998224725',
      infracoes: [{ numeroAit: 'A1' }],
    });
  });

  it('notificacoes → wraps SNE projection', async () => {
    const { svc } = make((sql) => {
      if (known(sql)) return { rows: [{ ok: true }] };
      if (sql.includes('v_sne_notificacao'))
        return { rows: [{ payload: { protocolo: 'SNE-1' } }] };
      return { rows: [] };
    });
    await expect(svc.notificacoes('52998224725')).resolves.toMatchObject({
      notificacoes: [{ protocolo: 'SNE-1' }],
    });
  });

  it('cnh → 404 when no condutor for the cpf', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(svc.cnh('00000000000')).rejects.toMatchObject({
      returnCode: 404,
    });
  });

  it('pagamento → 404 when infraction absent', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(svc.pagamento('AX')).rejects.toMatchObject({
      returnCode: 404,
    });
  });

  it('pagamento → returns the projection', async () => {
    const { svc } = make((sql) =>
      sql.includes('from contract.v_cdt_infracao')
        ? { rows: [{ payload: { numeroAit: 'A1', percentualDesconto: 40 } }] }
        : { rows: [] },
    );
    await expect(svc.pagamento('A1')).resolves.toMatchObject({
      percentualDesconto: 40,
    });
  });

  const infrow = (over: Record<string, unknown>) => ({
    numero_ait: 'A1',
    situacao: 'DISPONIVEL',
    percentual_desconto: 40,
    valor_original: '293.47',
    valor_com_desconto: '176.08',
    boleto_disponivel: true,
    linha_digitavel: 'X',
    reconhecida: false,
    ...over,
  });

  it('reconhecer → 200 and applies the discount', async () => {
    const { svc } = make((sql) =>
      sql.includes('from cdt.infracao where numero_ait')
        ? { rows: [infrow({})] }
        : { rows: [] },
    );
    const out = await svc.reconhecer('A1', {});
    expect(out.status).toBe(200);
    expect((out.body as Record<string, unknown>).situacao).toBe('RECONHECIDA');
  });

  it('reconhecer → 402 CDT.RECOGNITION.NOT_ALLOWED when terminal', async () => {
    const { svc } = make((sql) =>
      sql.includes('from cdt.infracao where numero_ait')
        ? { rows: [infrow({ situacao: 'PAGA' })] }
        : { rows: [] },
    );
    await expect(svc.reconhecer('A1', {})).rejects.toMatchObject({
      returnCode: 402,
    });
  });

  it('reconhecer → 402 CDT.DISCOUNT.NOT_AVAILABLE when no discount', async () => {
    const { svc } = make((sql) =>
      sql.includes('from cdt.infracao where numero_ait')
        ? {
            rows: [
              infrow({ percentual_desconto: 0, valor_com_desconto: null }),
            ],
          }
        : { rows: [] },
    );
    await expect(svc.reconhecer('A1', {})).rejects.toMatchObject({
      returnCode: 402,
    });
  });

  it('reconhecer → 404 when infraction absent', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(svc.reconhecer('AX', {})).rejects.toMatchObject({
      returnCode: 404,
    });
  });

  it('forwards a forced 500 on pagamento', async () => {
    const { svc } = make(() => ({ rows: [] }), { status: 500, message: 'x' });
    await expect(svc.pagamento('A0000500')).rejects.toMatchObject({
      returnCode: 500,
    });
  });
});
