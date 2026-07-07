import { describe, expect, it, vi } from 'vitest';
import { RenachController } from '../../domain/renach/api/src/renach.controller.js';
import { RenainfController } from '../../domain/renainf/api/src/renainf.controller.js';
import type { RenachService } from '../../domain/renach/api/src/renach.service.js';
import type { RenainfService } from '../../domain/renainf/api/src/renainf.service.js';

const res = () =>
  ({ status: vi.fn().mockReturnThis(), json: vi.fn() }) as never;
const wrapped = { status: 201, body: { ok: true } };
/** A service proxy whose every method resolves a {status, body} (or value). */
const svcProxy = <T>() =>
  new Proxy({}, { get: () => async () => wrapped }) as unknown as T;

describe('RenachController', () => {
  it('routes every endpoint and sets status for write results', async () => {
    const svc = svcProxy<RenachService>();
    const c = new RenachController(svc);
    const r = res();
    await c.getProcesso('RS1');
    await c.elegibilidade('RS1');
    await c.clinicas();
    await c.profissionais();
    await c.criarAgendamento('RS1', {}, 'k', r);
    await c.patchAgendamento('id', {});
    await c.checkin('id');
    await c.exameMedico('RS1', {}, 'k', r);
    await c.avaliacaoPsicologica('RS1', {}, 'k', r);
    await c.exames('RS1');
    await c.retificar('id', {}, r);
    await c.encaminharJunta('RS1', {}, r);
    await c.parecerJunta('RS1', {}, r);
    expect(
      (r as { status: ReturnType<typeof vi.fn> }).status,
    ).toHaveBeenCalledWith(201);
  });
});

describe('RenainfController', () => {
  it('routes every endpoint', async () => {
    const svc = svcProxy<RenainfService>();
    const c = new RenainfController(svc);
    const r = res();
    await c.dispositivo({}, 'k', r);
    await c.sincronizar();
    await c.faixa({}, r);
    await c.lote({}, r);
    await c.criarAit({}, 'k', r);
    await c.getAit('A1');
    await c.cancelar('A1', {}, r);
    await c.abrir({}, 'k', r);
    await c.notAutuacao('c1', {}, r);
    await c.indicar('c1', {}, r);
    await c.defesa('c1', {}, 'k', r);
    await c.penalidade('c1', {}, 'k', r);
    await c.notPenalidade('c1', {}, r);
    await c.recurso('c1', {}, 'k', r);
    await c.julgar('r1', {}, r);
    await c.debito('c1');
    await c.pagamento('c1', {}, 'k', r);
    expect(
      (r as { status: ReturnType<typeof vi.fn> }).status,
    ).toHaveBeenCalledWith(201);
  });
});
