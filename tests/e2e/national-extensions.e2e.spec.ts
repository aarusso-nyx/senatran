import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createE2eApp, AUTH, type TestApp } from '../utils/e2e-app.js';

/**
 * SNE / CDT / DETRAN-bridge national extensions (INV-SNE/CDT/DETRAN-001): auth,
 * the adherence/discount/profile business rules, idempotency and the magic-key
 * 500s. Assumes a fresh `pnpm db:reset`.
 */
let ctx: TestApp;
beforeAll(async () => {
  ctx = await createE2eApp();
});
afterAll(async () => {
  await ctx.close();
});

const RESERVED_CPF = '00000000000';
const post = (p: string, body: unknown, extra: Record<string, string> = {}) =>
  request(ctx.server)
    .post(p)
    .set(AUTH)
    .set(extra)
    .send(body as object);
const get = (p: string) => request(ctx.server).get(p).set(AUTH);
const uniqueAit = () =>
  `E2E${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`;

describe('SNE (INV-SNE-001)', () => {
  it('requires x-cpf-usuario', async () => {
    const res = await request(ctx.server).get(
      '/v1/sne/adesoes/veiculos/ABC1D23',
    );
    expect(res.status).toBe(401);
  });

  it('rejects the reserved CPF', async () => {
    const res = await request(ctx.server)
      .get('/v1/sne/adesoes/veiculos/ABC1D23')
      .set({ ...AUTH, 'x-cpf-usuario': RESERVED_CPF });
    expect(res.status).toBe(401);
  });

  it('GET adherence: adherent vehicle vs non-adherent agency', async () => {
    expect((await get('/v1/sne/adesoes/veiculos/ABC1D23')).body.aderido).toBe(
      true,
    );
    expect((await get('/v1/sne/orgaos/999998/adesao')).body.aderido).toBe(
      false,
    );
  });

  it('notify autuação → 201 ACEITA for an adherent agency + recipient', async () => {
    const res = await post('/v1/sne/notificacoes/autuacao', {
      numeroAit: uniqueAit(),
      codigoOrgaoAutuador: '204020',
      placa: 'ABC1D23',
      cpfDestinatario: '52998224725',
    });
    expect(res.status).toBe(201);
    expect(res.body.situacao).toBe('ACEITA');
  });

  it('non-adherent agency → 402 SNE.AGENCY.NOT_ADHERED', async () => {
    const res = await post('/v1/sne/notificacoes/autuacao', {
      numeroAit: uniqueAit(),
      codigoOrgaoAutuador: '999998',
      placa: 'ABC1D23',
    });
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('SNE.AGENCY.NOT_ADHERED');
  });

  it('non-adherent recipient → 402 SNE.NOT_ADHERED', async () => {
    const res = await post('/v1/sne/notificacoes/autuacao', {
      numeroAit: uniqueAit(),
      codigoOrgaoAutuador: '204020',
      placa: 'IND1I01',
    });
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('SNE.NOT_ADHERED');
  });

  it('late notification → 402 SNE.NOTICE.DEADLINE_EXPIRED', async () => {
    const res = await post('/v1/sne/notificacoes/autuacao', {
      numeroAit: uniqueAit(),
      codigoOrgaoAutuador: '204020',
      placa: 'ABC1D23',
      dataInfracao: '2024-01-01T00:00:00Z',
      dataNotificacao: '2024-05-01T00:00:00Z',
    });
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('SNE.NOTICE.DEADLINE_EXPIRED');
  });

  it('is idempotent under Idempotency-Key; keyless duplicate → 402', async () => {
    const ait = uniqueAit();
    const body = {
      numeroAit: ait,
      codigoOrgaoAutuador: '204020',
      placa: 'ABC1D23',
    };
    const key = `e2e-sne-${ait}`;
    const first = await post('/v1/sne/notificacoes/penalidade', body, {
      'Idempotency-Key': key,
    });
    const replay = await post('/v1/sne/notificacoes/penalidade', body, {
      'Idempotency-Key': key,
    });
    expect(first.status).toBe(201);
    expect(replay.body.protocolo).toBe(first.body.protocolo);
    // A keyless second notice for the same (AIT, tipo) is rejected.
    const dup = await post('/v1/sne/notificacoes/penalidade', body);
    expect(dup.status).toBe(402);
    expect(dup.body.message).toContain('SNE.NOTIFICATION.INVALID_STATUS');
  });

  it('GET seeded notification, unknown → 404', async () => {
    expect((await get('/v1/sne/notificacoes/SNE-SEED-AUT-0001')).status).toBe(
      200,
    );
    expect((await get('/v1/sne/notificacoes/SNE-NOPE')).status).toBe(404);
  });

  it('magic órgão 999999 → forced 500', async () => {
    const res = await post('/v1/sne/notificacoes/autuacao', {
      numeroAit: uniqueAit(),
      codigoOrgaoAutuador: '999999',
      placa: 'ABC1D23',
    });
    expect(res.status).toBe(500);
  });
});

describe('CDT (INV-CDT-001)', () => {
  it('citizen views for a known citizen', async () => {
    expect((await get('/v1/cdt/cidadaos/52998224725/infracoes')).status).toBe(
      200,
    );
    expect((await get('/v1/cdt/cidadaos/52998224725/veiculos')).status).toBe(
      200,
    );
    expect((await get('/v1/cdt/cidadaos/52998224725/cnh')).status).toBe(200);
    expect(
      (await get('/v1/cdt/cidadaos/52998224725/notificacoes')).status,
    ).toBe(200);
  });

  it('unknown citizen → 404 CDT.CITIZEN.NOT_FOUND', async () => {
    const res = await get('/v1/cdt/cidadaos/99999999999/infracoes');
    expect(res.status).toBe(404);
    expect(res.body.message).toContain('CDT.CITIZEN.NOT_FOUND');
  });

  it('payment projection exposes the discount tier', async () => {
    expect(
      (await get('/v1/cdt/infracoes/A0001001/pagamento')).body
        .percentualDesconto,
    ).toBe(40);
    expect(
      (await get('/v1/cdt/infracoes/A0001002/pagamento')).body
        .percentualDesconto,
    ).toBe(20);
    expect(
      (await get('/v1/cdt/infracoes/A0001003/pagamento')).body
        .percentualDesconto,
    ).toBe(0);
    expect(
      (await get('/v1/cdt/infracoes/A0001004/pagamento')).body.boletoDisponivel,
    ).toBe(false);
  });

  it('unknown infraction pagamento → 404 CDT.INFRACTION.NOT_FOUND', async () => {
    const res = await get('/v1/cdt/infracoes/A9999999/pagamento');
    expect(res.status).toBe(404);
    expect(res.body.message).toContain('CDT.INFRACTION.NOT_FOUND');
  });

  it('reconhecimento of a no-discount infraction → 402 CDT.DISCOUNT.NOT_AVAILABLE', async () => {
    const res = await post('/v1/cdt/infracoes/A0001003/reconhecimento', {});
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('CDT.DISCOUNT.NOT_AVAILABLE');
  });

  it('reconhecimento of a terminal infraction → 402 CDT.RECOGNITION.NOT_ALLOWED', async () => {
    const res = await post('/v1/cdt/infracoes/A0001005/reconhecimento', {});
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('CDT.RECOGNITION.NOT_ALLOWED');
  });

  it('reconhecimento of a 40% infraction → 200 RECONHECIDA', async () => {
    const res = await post('/v1/cdt/infracoes/A0001001/reconhecimento', {});
    expect(res.status).toBe(200);
    expect(res.body.situacao).toBe('RECONHECIDA');
    expect(res.body.percentualDesconto).toBe(40);
  });

  it('magic AIT A0000500 → forced 500', async () => {
    expect((await get('/v1/cdt/infracoes/A0000500/pagamento')).status).toBe(
      500,
    );
  });
});

describe('DETRAN bridge (INV-DETRAN-001)', () => {
  it('bridge on an active UF → 201 with linked protocols', async () => {
    const res = await post('/v1/detrans/SP/renavam/consultasVeiculo', {
      placa: 'ABC1D23',
      versaoLeiaute: '1.0',
    });
    expect(res.status).toBe(201);
    expect(res.body.protocoloDetran).toMatch(/^DTR-SP-/);
    expect(res.body.protocoloNacional).toMatch(/^RENAVAM-/);
  });

  it('inactive UF → 402 DETRAN.PROFILE.INACTIVE', async () => {
    const res = await post('/v1/detrans/RJ/renavam/consultasVeiculo', {
      placa: 'ABC1D23',
    });
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('DETRAN.PROFILE.INACTIVE');
  });

  it('unknown UF → 404 DETRAN.PROFILE.NOT_FOUND', async () => {
    const res = await post('/v1/detrans/AC/renavam/consultasVeiculo', {
      placa: 'ABC1D23',
    });
    expect(res.status).toBe(404);
    expect(res.body.message).toContain('DETRAN.PROFILE.NOT_FOUND');
  });

  it('layout mismatch → 400 DETRAN.LAYOUT.INVALID', async () => {
    const res = await post('/v1/detrans/SP/renavam/consultasVeiculo', {
      placa: 'ABC1D23',
      versaoLeiaute: '9.9',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('DETRAN.LAYOUT.INVALID');
  });

  it('homologation profile → 402 DETRAN.BRIDGE.REJECTED', async () => {
    const res = await post('/v1/detrans/BA/renavam/consultasVeiculo', {
      placa: 'ABC1D23',
    });
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('DETRAN.BRIDGE.REJECTED');
  });

  it('other national bridges work on an active UF', async () => {
    expect(
      (
        await post('/v1/detrans/SP/renach/consultasCondutor', {
          cpf: '52998224725',
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await post('/v1/detrans/SP/renainf/autosInfracao', {
          numeroAit: uniqueAit(),
        })
      ).status,
    ).toBe(201);
    expect(
      (await post('/v1/detrans/SP/renaest/sinistros', { dados: {} })).status,
    ).toBe(201);
    expect(
      (
        await post('/v1/detrans/SP/sne/notificacoes', {
          numeroAit: uniqueAit(),
        })
      ).status,
    ).toBe(201);
  });

  it('GET the seeded bridged AIT → 200', async () => {
    const res = await get('/v1/detrans/SP/renainf/autosInfracao/A0001001');
    expect(res.status).toBe(200);
    expect(res.body.numeroAit).toBe('A0001001');
  });

  it('is idempotent under Idempotency-Key', async () => {
    const key = `e2e-detran-${Date.now()}`;
    const body = { placa: 'ABC1D23' };
    const first = await post('/v1/detrans/SP/renavam/consultasVeiculo', body, {
      'Idempotency-Key': key,
    });
    const replay = await post('/v1/detrans/SP/renavam/consultasVeiculo', body, {
      'Idempotency-Key': key,
    });
    expect(replay.body.protocoloDetran).toBe(first.body.protocoloDetran);
  });

  it('magic UF ZZ → forced 500', async () => {
    expect(
      (await post('/v1/detrans/ZZ/renavam/consultasVeiculo', {})).status,
    ).toBe(500);
  });
});
