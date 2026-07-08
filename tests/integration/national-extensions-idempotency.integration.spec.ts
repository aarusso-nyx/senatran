import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDatabase } from '../../domain/shared/api/src/database/database.js';
import { loadConfig } from '../../domain/shared/api/src/config/configuration.js';
import { TransactionSupport } from '../../domain/shared/api/src/common/transaction-support.service.js';
import { ScenarioService } from '../../domain/shared/api/src/common/scenario.service.js';
import { SneService } from '../../domain/sne/api/src/sne.service.js';
import { DetranService } from '../../domain/detran/api/src/detran.service.js';

/**
 * Integration (INV-SNE/DETRAN-001 + INV-IDEMP-001): SNE notifications and DETRAN
 * bridges are idempotent under an Idempotency-Key and audited; keyless duplicates
 * fire the business rule. Requires `pnpm db:reset`.
 */
let db: PgDatabase;
let sne: SneService;
let detran: DetranService;
beforeAll(() => {
  const cfg = loadConfig();
  db = new PgDatabase(cfg.database);
  const tx = new TransactionSupport(db);
  const scenario = new ScenarioService(db, cfg);
  sne = new SneService(db, tx, scenario);
  detran = new DetranService(db, tx, scenario);
});
afterAll(() => db.close());

const notif = (ait: string) => ({
  numeroAit: ait,
  codigoOrgaoAutuador: '204020',
  placa: 'ABC1D23',
  cpfDestinatario: '52998224725',
});

describe('SNE idempotency + audit', () => {
  it('records audit + ledger rows, replays under the same key', async () => {
    const ait = 'IT' + Date.now().toString().slice(-8);
    const key = 'sne-' + ait;
    const out = (await sne.notificarAutuacao(notif(ait), key)) as {
      status: number;
      body: { protocolo: string };
    };
    expect(out.status).toBe(201);

    const audit = await db.query<{ n: number }>(
      "select count(*)::int as n from audit.evento where entidade = 'sne.notificacao' and entidade_id = $1 and payload_hash is not null",
      [out.body.protocolo],
    );
    expect(audit.rows[0].n).toBe(1);

    const ledger = await db.query<{ n: number }>(
      'select count(*)::int as n from audit.idempotencia where escopo = $1 and chave = $2',
      ['sne.notificacao.AUTUACAO', key],
    );
    expect(ledger.rows[0].n).toBe(1);

    const replay = await sne.notificarAutuacao(notif(ait), key);
    expect(replay).toEqual(out);
  });

  it('a keyless duplicate (numeroAit, tipo) → SNE.NOTIFICATION.INVALID_STATUS (402)', async () => {
    const ait = 'IT' + Date.now().toString().slice(-8) + 'D';
    await sne.notificarAutuacao(notif(ait));
    await expect(sne.notificarAutuacao(notif(ait))).rejects.toMatchObject({
      returnCode: 402,
    });
  });
});

describe('DETRAN bridge idempotency + audit', () => {
  it('records audit + ledger rows, replays under the same key', async () => {
    const key = 'detran-' + Date.now();
    const out = (await detran.consultarVeiculo(
      'SP',
      { placa: 'ABC1D23' },
      key,
    )) as {
      status: number;
      body: { protocoloDetran: string };
    };
    expect(out.status).toBe(201);

    const audit = await db.query<{ n: number }>(
      "select count(*)::int as n from audit.evento where entidade = 'detran.bridge' and entidade_id = $1 and payload_hash is not null",
      [out.body.protocoloDetran],
    );
    expect(audit.rows[0].n).toBe(1);

    const ledger = await db.query<{ n: number }>(
      'select count(*)::int as n from audit.idempotencia where escopo = $1 and chave = $2',
      ['detran.bridge.RENAVAM:SP', key],
    );
    expect(ledger.rows[0].n).toBe(1);

    const replay = await detran.consultarVeiculo(
      'SP',
      { placa: 'ABC1D23' },
      key,
    );
    expect(replay).toEqual(out);
  });
});
