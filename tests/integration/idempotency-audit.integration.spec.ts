import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDatabase } from '../../domain/shared/api/src/database/database.js';
import { loadConfig } from '../../domain/shared/api/src/config/configuration.js';
import { TransactionSupport } from '../../domain/shared/api/src/common/transaction-support.service.js';
import { RenainfService } from '../../domain/renainf/api/src/renainf.service.js';

/**
 * Integration (INV-IDEMP-001): transactional writes are idempotent under an
 * Idempotency-Key and fully audited; a plain replay still triggers the business
 * duplicate error. Requires `pnpm db:reset` (or at least the schema applied).
 */
let db: PgDatabase;
let svc: RenainfService;
beforeAll(() => {
  db = new PgDatabase(loadConfig().database);
  svc = new RenainfService(db, new TransactionSupport(db));
});
afterAll(() => db.close());

const ait = (numeroAit: string) => ({
  numeroAit,
  codigoOrgaoAutuador: '204020',
  agenteAutuador: { cpf: '52998224725', matricula: 'A1' },
  infracao: { codigoInfracao: '74550', dataInfracao: '2026-01-01T10:00:00Z' },
  veiculo: { placa: 'ABC1D23' },
  evidencias: [{ tipo: 'PHOTO', hash: 'sha256' }],
});

describe('idempotency + audit', () => {
  it('records an audit event and an idempotency ledger row on create', async () => {
    const numero = 'IT' + Date.now().toString().slice(-8);
    const key = 'key-' + numero;
    const out = await svc.criarAit(ait(numero), key);
    expect(out.status).toBe(201);

    const audit = await db.query<{ n: number }>(
      "select count(*)::int as n from audit.evento where entidade = 'renainf.ait' and entidade_id = $1 and payload_hash is not null",
      [numero],
    );
    expect(audit.rows[0].n).toBe(1);

    const ledger = await db.query<{ n: number }>(
      'select count(*)::int as n from audit.idempotencia where escopo = $1 and chave = $2',
      ['renainf.ait', key],
    );
    expect(ledger.rows[0].n).toBe(1);
  });

  it('replays the same Idempotency-Key without creating a duplicate', async () => {
    const numero = 'IT' + Date.now().toString().slice(-8) + 'R';
    const key = 'key-' + numero;
    const first = await svc.criarAit(ait(numero), key);
    const replay = await svc.criarAit(ait(numero), key);
    expect(replay).toEqual(first);
    const count = await db.query<{ n: number }>(
      'select count(*)::int as n from renainf.ait where numero_ait = $1',
      [numero],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('a plain replay (no key) triggers RENAINF.AIT.DUPLICATED (402)', async () => {
    const numero = 'IT' + Date.now().toString().slice(-8) + 'D';
    await svc.criarAit(ait(numero)); // no key
    await expect(svc.criarAit(ait(numero))).rejects.toMatchObject({
      returnCode: 402,
    });
  });
});
