import { describe, expect, it } from 'vitest';
import { SneService } from './sne.service.js';
import { TransactionSupport } from '../../../shared/api/src/common/transaction-support.service.js';
import { ScenarioService } from '../../../shared/api/src/common/scenario.service.js';
import { DatabaseStub } from '../../../../tests/utils/database.stub.js';

type Handler = (sql: string, params: unknown[]) => { rows: unknown[] };
type Forced = { status: number; message: string } | null;

const make = (handler: Handler, forced: Forced = null) => {
  const db = new DatabaseStub();
  db.handler = (sql, params) => handler(sql, params);
  const scenario = { forced: async () => forced } as unknown as ScenarioService;
  return { db, svc: new SneService(db, new TransactionSupport(db), scenario) };
};

// Adherence handler: `orgao`/`alvo` decide the two sne.adesao lookups; the rest
// (idempotencia select, dup select, inserts) return empty.
const adhesionFlow =
  (orgao: boolean, alvo: boolean, dup = false): Handler =>
  (sql, params) => {
    if (sql.includes('from sne.adesao')) {
      const aderido = params[0] === 'ORGAO' ? orgao : alvo;
      return { rows: [{ aderido, canal: 'APP_CDT' }] };
    }
    if (sql.includes('from sne.notificacao where numero_ait'))
      return { rows: dup ? [{ '?column?': 1 }] : [] };
    return { rows: [] };
  };

const notif = (over: Record<string, unknown> = {}) => ({
  numeroAit: 'A1',
  codigoOrgaoAutuador: '204020',
  placa: 'ABC1D23',
  ...over,
});

describe('SneService', () => {
  it('adesaoVeiculo → aderido from the registry', async () => {
    const { svc } = make(() => ({
      rows: [{ aderido: true, canal: 'APP_CDT' }],
    }));
    await expect(svc.adesaoVeiculo('ABC1D23')).resolves.toMatchObject({
      placa: 'ABC1D23',
      aderido: true,
    });
  });

  it('adesaoVeiculo → aderido:false when absent', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(svc.adesaoVeiculo('ZZZ0000')).resolves.toMatchObject({
      aderido: false,
    });
  });

  it('notificarAutuacao → 201 when agency + recipient adhere', async () => {
    const { svc } = make(adhesionFlow(true, true));
    const out = await svc.notificarAutuacao(notif(), 'k1');
    expect(out.status).toBe(201);
    expect((out.body as Record<string, unknown>).situacao).toBe('ACEITA');
  });

  it('notificarAutuacao → INDISPONIVEL channel yields PENDENTE', async () => {
    const { svc } = make(adhesionFlow(true, true));
    const out = await svc.notificarAutuacao(
      notif({ canal: 'INDISPONIVEL' }),
      'k2',
    );
    expect((out.body as Record<string, unknown>).situacao).toBe('PENDENTE');
  });

  it('notificarAutuacao → 402 SNE.AGENCY.NOT_ADHERED', async () => {
    const { svc } = make(adhesionFlow(false, true));
    await expect(svc.notificarAutuacao(notif())).rejects.toMatchObject({
      returnCode: 402,
    });
  });

  it('notificarAutuacao → 402 SNE.NOT_ADHERED for a non-adherent recipient', async () => {
    const { svc } = make(adhesionFlow(true, false));
    await expect(svc.notificarAutuacao(notif())).rejects.toMatchObject({
      returnCode: 402,
    });
  });

  it('notificarAutuacao → 402 SNE.NOTICE.DEADLINE_EXPIRED', async () => {
    const { svc } = make(adhesionFlow(true, true));
    await expect(
      svc.notificarAutuacao(
        notif({
          dataInfracao: '2024-01-01T00:00:00Z',
          dataNotificacao: '2024-05-01T00:00:00Z',
        }),
      ),
    ).rejects.toMatchObject({ returnCode: 402 });
  });

  it('notificarAutuacao → 402 INVALID_STATUS on a keyless duplicate', async () => {
    const { svc } = make(adhesionFlow(true, true, true));
    await expect(svc.notificarAutuacao(notif())).rejects.toMatchObject({
      returnCode: 402,
    });
  });

  it('notificarAutuacao → forwards a forced 500', async () => {
    const { svc } = make(adhesionFlow(true, true), {
      status: 500,
      message: 'x',
    });
    await expect(svc.notificarAutuacao(notif())).rejects.toMatchObject({
      returnCode: 500,
    });
  });

  it('getNotificacao → 404 when unknown', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(svc.getNotificacao('SNE-x')).rejects.toMatchObject({
      returnCode: 404,
    });
  });

  it('cancelar → 200 on a non-terminal notice', async () => {
    const { svc } = make((sql) =>
      sql.includes('from sne.notificacao where protocolo')
        ? { rows: [{ situacao: 'ACEITA' }] }
        : { rows: [] },
    );
    const out = await svc.cancelar('SNE-1', {});
    expect(out.status).toBe(200);
    expect((out.body as Record<string, unknown>).situacao).toBe('CANCELADA');
  });

  it('cancelar → 402 INVALID_STATUS on a terminal notice', async () => {
    const { svc } = make((sql) =>
      sql.includes('from sne.notificacao where protocolo')
        ? { rows: [{ situacao: 'EXPIRADA' }] }
        : { rows: [] },
    );
    await expect(svc.cancelar('SNE-1', {})).rejects.toMatchObject({
      returnCode: 402,
    });
  });

  it('cancelar → 404 when unknown', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(svc.cancelar('SNE-x', {})).rejects.toMatchObject({
      returnCode: 404,
    });
  });
});
