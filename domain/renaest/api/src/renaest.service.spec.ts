import { describe, expect, it } from 'vitest';
import { RenaestService } from './renaest.service.js';
import { TransactionSupport } from '../../../shared/api/src/common/transaction-support.service.js';
import { ScenarioService } from '../../../shared/api/src/common/scenario.service.js';
import { DatabaseStub } from '../../../../tests/utils/database.stub.js';

type Rows = (sql: string) => { rows: unknown[] };
type Forced = { status: number; message: string } | null;

const make = (rows: Rows, forced: Forced = null) => {
  const db = new DatabaseStub();
  db.handler = (sql) => rows(sql);
  const scenario = {
    forced: async () => forced,
  } as unknown as ScenarioService;
  return {
    db,
    svc: new RenaestService(db, new TransactionSupport(db), scenario),
  };
};

const bodyOk = () => ({
  dataHoraSinistro: '2024-02-11T19:05:00.000Z',
  uf: 'SP',
  codigoMunicipio: '3550308',
  gravidade: 'COM_VITIMA_FERIDA',
  local: 'KM 120',
  orgaoResponsavel: 'DETRAN-SP',
  vitimas: [{ gravidadeLesao: 'LEVE' }],
});

// Handler that supports the happy-path insert flow; no existing duplicate.
const insertFlow =
  (dup = false): Rows =>
  (sql) => {
    if (sql.includes('nextval')) return { rows: [{ id: 'SN00000000010' }] };
    if (sql.includes('where chave_natural'))
      return { rows: dup ? [{ '?column?': 1 }] : [] };
    return { rows: [] }; // idempotencia select, inserts, audit
  };

describe('RenaestService', () => {
  it('submeterSinistro → 201 with minted idSinistro + protocolo', async () => {
    const { svc } = make(insertFlow());
    const out = await svc.submeterSinistro(bodyOk(), 'key-1');
    expect(out.status).toBe(201);
    const b = out.body as Record<string, unknown>;
    expect(b.idSinistro).toBe('SN00000000010');
    expect(typeof b.protocolo).toBe('string');
    expect(b.situacao).toBe('RECEBIDO');
  });

  it('submeterSinistro → 400 RENAEST.CRASH.INVALID_LAYOUT for a bad leiaute', async () => {
    const { svc } = make(insertFlow());
    await expect(
      svc.submeterSinistro({ ...bodyOk(), versaoLeiaute: '9.9' }),
    ).rejects.toMatchObject({ returnCode: 400 });
  });

  it('submeterSinistro → 402 INCOMPLETE_DATA when a victim crash has no vitimas', async () => {
    const { svc } = make(insertFlow());
    await expect(
      svc.submeterSinistro({ ...bodyOk(), vitimas: [] }),
    ).rejects.toMatchObject({ returnCode: 402 });
  });

  it('submeterSinistro → 402 INCOMPLETE_DATA when local is missing', async () => {
    const { svc } = make(insertFlow());
    const b = bodyOk() as Record<string, unknown>;
    delete b.local;
    await expect(svc.submeterSinistro(b)).rejects.toMatchObject({
      returnCode: 402,
    });
  });

  it('submeterSinistro → 402 RENAEST.CRASH.DUPLICATED on a same-tuple resubmit without key', async () => {
    const { svc } = make(insertFlow(true));
    await expect(svc.submeterSinistro(bodyOk())).rejects.toMatchObject({
      returnCode: 402,
    });
  });

  it('submeterSinistro → forwards a forced 500 magic key', async () => {
    const { svc } = make(insertFlow(), {
      status: 500,
      message: 'fonte indisponível',
    });
    await expect(svc.submeterSinistro(bodyOk())).rejects.toMatchObject({
      returnCode: 500,
    });
  });

  it('getSinistro → 404 when unknown', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(svc.getSinistro('SNX')).rejects.toMatchObject({
      returnCode: 404,
    });
  });

  it('getProtocolo → 404 when unknown', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(svc.getProtocolo('RENAEST-x')).rejects.toMatchObject({
      returnCode: 404,
    });
  });

  it('corrigir → 202 on a non-terminal record', async () => {
    const { svc } = make((sql) =>
      sql.includes('from renaest.sinistro where id_sinistro')
        ? { rows: [{ id_sinistro: 'SN1', situacao: 'RECEBIDO' }] }
        : { rows: [] },
    );
    const out = await svc.corrigir('SN1', { motivo: 'ajuste' });
    expect(out.status).toBe(202);
    expect((out.body as Record<string, unknown>).tipo).toBe('CORRECAO');
  });

  it('corrigir → 402 CORRECTION_NOT_ALLOWED on a terminal record', async () => {
    const { svc } = make((sql) =>
      sql.includes('from renaest.sinistro where id_sinistro')
        ? { rows: [{ id_sinistro: 'SN5', situacao: 'REJEITADO' }] }
        : { rows: [] },
    );
    await expect(
      svc.corrigir('SN5', { motivo: 'ajuste' }),
    ).rejects.toMatchObject({ returnCode: 402 });
  });

  it('complementar → 404 when the crash is unknown', async () => {
    const { svc } = make(() => ({ rows: [] }));
    await expect(svc.complementar('SNX', {})).rejects.toMatchObject({
      returnCode: 404,
    });
  });
});
