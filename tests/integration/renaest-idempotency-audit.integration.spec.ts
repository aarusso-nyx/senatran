import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDatabase } from '../../domain/shared/api/src/database/database.js';
import { loadConfig } from '../../domain/shared/api/src/config/configuration.js';
import { TransactionSupport } from '../../domain/shared/api/src/common/transaction-support.service.js';
import { ScenarioService } from '../../domain/shared/api/src/common/scenario.service.js';
import { RenaestService } from '../../domain/renaest/api/src/renaest.service.js';

/**
 * Integration (INV-RENAEST-001 + INV-IDEMP-001): RENAEST crash submissions are
 * idempotent under an Idempotency-Key and fully audited; a plain resubmit of the
 * same natural tuple triggers RENAEST.CRASH.DUPLICATED. Requires `pnpm db:reset`.
 */
let db: PgDatabase;
let svc: RenaestService;
beforeAll(() => {
  const cfg = loadConfig();
  db = new PgDatabase(cfg.database);
  svc = new RenaestService(
    db,
    new TransactionSupport(db),
    new ScenarioService(db, cfg),
  );
});
afterAll(() => db.close());

const crash = (org: string) => ({
  dataHoraSinistro: '2024-07-01T12:00:00.000Z',
  uf: 'SP',
  codigoMunicipio: '3550308',
  gravidade: 'SEM_VITIMA',
  local: 'KM 10',
  orgaoResponsavel: org,
});

describe('renaest idempotency + audit', () => {
  it('records an audit event and an idempotency ledger row on create', async () => {
    const org = 'ORG' + Date.now().toString().slice(-8);
    const key = 'key-' + org;
    const out = (await svc.submeterSinistro(crash(org), key)) as {
      status: number;
      body: { idSinistro: string };
    };
    expect(out.status).toBe(201);

    const audit = await db.query<{ n: number }>(
      "select count(*)::int as n from audit.evento where entidade = 'renaest.sinistro' and entidade_id = $1 and payload_hash is not null",
      [out.body.idSinistro],
    );
    expect(audit.rows[0].n).toBe(1);

    const ledger = await db.query<{ n: number }>(
      'select count(*)::int as n from audit.idempotencia where escopo = $1 and chave = $2',
      ['renaest.sinistro', key],
    );
    expect(ledger.rows[0].n).toBe(1);
  });

  it('replays the same Idempotency-Key without creating a duplicate row', async () => {
    const org = 'ORG' + Date.now().toString().slice(-8) + 'R';
    const key = 'key-' + org;
    const first = await svc.submeterSinistro(crash(org), key);
    const replay = await svc.submeterSinistro(crash(org), key);
    expect(replay).toEqual(first);
    const count = await db.query<{ n: number }>(
      'select count(*)::int as n from renaest.sinistro where orgao_responsavel = $1',
      [org],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('a plain resubmit (no key) triggers RENAEST.CRASH.DUPLICATED (402)', async () => {
    const org = 'ORG' + Date.now().toString().slice(-8) + 'D';
    await svc.submeterSinistro(crash(org)); // no key
    await expect(svc.submeterSinistro(crash(org))).rejects.toMatchObject({
      returnCode: 402,
    });
  });
});
