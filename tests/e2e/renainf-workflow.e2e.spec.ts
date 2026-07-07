import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createE2eApp, AUTH, type TestApp } from '../utils/e2e-app.js';

/**
 * INV-RENAINF-001 — a full, fresh RENAINF lifecycle driven end to end so the
 * suite is repeatable without depending on mutable seed rows. Each run mints a
 * unique AIT number.
 *
 * NOTE ON IDEMPOTENCY: the transactional writes are idempotent by natural key
 * (numeroAit / idProcesso). Replaying a write with the SAME natural key (no
 * Idempotency-Key) returns the ORIGINAL result — it does not re-run the business
 * rule. So the "second call must fail with a business error" cases below supply a
 * DISTINCT `Idempotency-Key` on the second call, which is the only path that
 * reaches the state-machine guard.
 */
let ctx: TestApp;
beforeAll(async () => {
  ctx = await createE2eApp();
});
afterAll(async () => {
  await ctx.close();
});

const post = (path: string, body: unknown, idemKey?: string) => {
  let r = request(ctx.server)
    .post(path)
    .set(AUTH)
    .set('Content-Type', 'application/json');
  if (idemKey) r = r.set('Idempotency-Key', idemKey);
  return r.send(body as object);
};
const get = (path: string) => request(ctx.server).get(path).set(AUTH);

describe('renainf lifecycle (INV-RENAINF-001)', () => {
  const AIT = 'T' + Date.now().toString().slice(-7);
  let idProcesso = '';
  let idRecurso = '';

  it('POST autosInfracao → 201 VALIDADO', async () => {
    const res = await post('/v1/renainf/autosInfracao', {
      numeroAit: AIT,
      codigoOrgaoAutuador: '204020',
      agenteAutuador: { cpf: '52998224725', matricula: 'AGT1' },
      infracao: {
        codigoInfracao: '74550',
        dataInfracao: '2026-01-01T10:00:00Z',
      },
      veiculo: { placa: 'ABC1D23' },
    });
    expect(res.status).toBe(201);
    expect(res.body.situacao).toBe('VALIDADO');
  });

  it('duplicate numeroAit → 402 RENAINF.AIT.DUPLICATED', async () => {
    // Distinct Idempotency-Key so the duplicate is re-evaluated (not replayed).
    const res = await post(
      '/v1/renainf/autosInfracao',
      {
        numeroAit: AIT,
        codigoOrgaoAutuador: '204020',
        agenteAutuador: { cpf: '52998224725', matricula: 'AGT1' },
        infracao: {
          codigoInfracao: '74550',
          dataInfracao: '2026-01-01T10:00:00Z',
        },
        veiculo: { placa: 'ABC1D23' },
      },
      `dup-${AIT}`,
    );
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('RENAINF.AIT.DUPLICATED');
  });

  it('missing numeroAit → 400 RENAINF.AIT.INVALID_NUMBER', async () => {
    const res = await post('/v1/renainf/autosInfracao', {
      codigoOrgaoAutuador: '204020',
      infracao: { codigoInfracao: '74550' },
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('RENAINF.AIT.INVALID_NUMBER');
  });

  it('missing infraction code → 400 RENAINF.AIT.INVALID_INFRACTION_CODE', async () => {
    const res = await post('/v1/renainf/autosInfracao', {
      numeroAit: `${AIT}9`,
      codigoOrgaoAutuador: '204020',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('RENAINF.AIT.INVALID_INFRACTION_CODE');
  });

  it('POST processosAdministrativos → 201 (capture idProcesso)', async () => {
    const res = await post('/v1/renainf/processosAdministrativos', {
      numeroAit: AIT,
    });
    expect(res.status).toBe(201);
    expect(typeof res.body.idProcesso).toBe('string');
    idProcesso = res.body.idProcesso;
  });

  it('penalty before autuação/defesa → 402 RENAINF.CASE.INVALID_STATUS', async () => {
    const res = await post(
      `/v1/renainf/processosAdministrativos/${idProcesso}/penalidades`,
      {},
    );
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('RENAINF.CASE.INVALID_STATUS');
  });

  it('POST notificacoes/autuacao → 201 AGUARDANDO_DEFESA_PREVIA', async () => {
    const res = await post(
      `/v1/renainf/processosAdministrativos/${idProcesso}/notificacoes/autuacao`,
      {},
    );
    expect(res.status).toBe(201);
    expect(res.body.situacao).toBe('AGUARDANDO_DEFESA_PREVIA');
  });

  it('defesa with invalid actor → 402 RENAINF.DEFENSE.INVALID_ACTOR', async () => {
    const res = await post(
      `/v1/renainf/processosAdministrativos/${idProcesso}/defesasPrevias`,
      { requerente: { tipoRequerente: 'BOGUS', numeroDocumento: 'x' } },
    );
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('RENAINF.DEFENSE.INVALID_ACTOR');
  });

  it('POST defesasPrevias → 201', async () => {
    const res = await post(
      `/v1/renainf/processosAdministrativos/${idProcesso}/defesasPrevias`,
      {
        requerente: { tipoRequerente: 'PROPRIETARIO', numeroDocumento: 'x' },
        fundamentacao: 'Defesa prévia de teste.',
      },
    );
    expect(res.status).toBe(201);
  });

  it('POST penalidades → 201 PENALIDADE_IMPOSTA', async () => {
    const res = await post(
      `/v1/renainf/processosAdministrativos/${idProcesso}/penalidades`,
      {},
    );
    expect(res.status).toBe(201);
    expect(res.body.situacao).toBe('PENALIDADE_IMPOSTA');
  });

  it('second penalty → 402 RENAINF.PENALTY.ALREADY_IMPOSED', async () => {
    // Distinct key so the guard runs again instead of replaying the first result.
    const res = await post(
      `/v1/renainf/processosAdministrativos/${idProcesso}/penalidades`,
      {},
      `pen2-${idProcesso}`,
    );
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('RENAINF.PENALTY.ALREADY_IMPOSED');
  });

  it('second-instance appeal before JARI → 402 PREVIOUS_INSTANCE_REQUIRED', async () => {
    const res = await post(
      `/v1/renainf/processosAdministrativos/${idProcesso}/recursos`,
      { instancia: 'SEGUNDA_INSTANCIA' },
    );
    expect(res.status).toBe(402);
    expect(res.body.message).toContain(
      'RENAINF.APPEAL.PREVIOUS_INSTANCE_REQUIRED',
    );
  });

  it('POST recursos JARI → 201 (capture idRecurso)', async () => {
    const res = await post(
      `/v1/renainf/processosAdministrativos/${idProcesso}/recursos`,
      { instancia: 'JARI' },
    );
    expect(res.status).toBe(201);
    expect(typeof res.body.idRecurso).toBe('string');
    idRecurso = res.body.idRecurso;
  });

  it('POST recursos SEGUNDA_INSTANCIA after JARI → 201', async () => {
    const res = await post(
      `/v1/renainf/processosAdministrativos/${idProcesso}/recursos`,
      { instancia: 'SEGUNDA_INSTANCIA' },
    );
    expect(res.status).toBe(201);
  });

  it('POST recursos/{idRecurso}/julgamento → 201', async () => {
    const res = await post(`/v1/renainf/recursos/${idRecurso}/julgamento`, {
      resultado: 'NEGADO',
    });
    expect(res.status).toBe(201);
  });

  it('GET debito → 200', async () => {
    const res = await get(
      `/v1/renainf/processosAdministrativos/${idProcesso}/debito`,
    );
    expect(res.status).toBe(200);
  });

  it('POST pagamentos → 201', async () => {
    const res = await post(
      `/v1/renainf/processosAdministrativos/${idProcesso}/pagamentos`,
      { valorPago: 195.23, formaPagamento: 'PIX' },
    );
    expect(res.status).toBe(201);
  });

  it('second payment → 402 RENAINF.PAYMENT.ALREADY_SETTLED', async () => {
    // Distinct key so the settlement guard runs again.
    const res = await post(
      `/v1/renainf/processosAdministrativos/${idProcesso}/pagamentos`,
      { valorPago: 195.23, formaPagamento: 'PIX' },
      `pay2-${idProcesso}`,
    );
    expect(res.status).toBe(402);
    expect(res.body.message).toContain('RENAINF.PAYMENT.ALREADY_SETTLED');
  });
});
