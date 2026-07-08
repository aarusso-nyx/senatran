import { describe, expect, it, vi } from 'vitest';
import { RenachController } from '../../domain/renach/api/src/renach.controller.js';
import { RenainfController } from '../../domain/renainf/api/src/renainf.controller.js';
import { RenaestController } from '../../domain/renaest/api/src/renaest.controller.js';
import { SneController } from '../../domain/sne/api/src/sne.controller.js';
import { CdtController } from '../../domain/cdt/api/src/cdt.controller.js';
import { DetranController } from '../../domain/detran/api/src/detran.controller.js';
import type { RenachService } from '../../domain/renach/api/src/renach.service.js';
import type { RenainfService } from '../../domain/renainf/api/src/renainf.service.js';
import type { RenaestService } from '../../domain/renaest/api/src/renaest.service.js';
import type { SneService } from '../../domain/sne/api/src/sne.service.js';
import type { CdtService } from '../../domain/cdt/api/src/cdt.service.js';
import type { DetranService } from '../../domain/detran/api/src/detran.service.js';

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

describe('RenaestController', () => {
  it('routes every endpoint and sets status for write results', async () => {
    const svc = svcProxy<RenaestService>();
    const c = new RenaestController(svc);
    const r = res();
    await c.submeter({} as never, 'k', r);
    await c.submeterLote({} as never, 'k', r);
    await c.getSinistro('SN1');
    await c.getProtocolo('RENAEST-1');
    await c.complementar('SN1', {} as never, r);
    await c.corrigir('SN1', {} as never, r);
    expect(
      (r as { status: ReturnType<typeof vi.fn> }).status,
    ).toHaveBeenCalledWith(201);
  });
});

describe('SneController', () => {
  it('routes every endpoint and sets status for write results', async () => {
    const svc = svcProxy<SneService>();
    const c = new SneController(svc);
    const r = res();
    await c.adesaoVeiculo('ABC1D23');
    await c.adesaoCidadao('52998224725');
    await c.adesaoOrgao('204020');
    await c.notificarAutuacao({} as never, 'k', r);
    await c.notificarPenalidade({} as never, 'k', r);
    await c.getNotificacao('SNE-1');
    await c.cancelar('SNE-1', {} as never, r);
    expect(
      (r as { status: ReturnType<typeof vi.fn> }).status,
    ).toHaveBeenCalledWith(201);
  });
});

describe('CdtController', () => {
  it('routes every endpoint and sets status for write results', async () => {
    const svc = svcProxy<CdtService>();
    const c = new CdtController(svc);
    const r = res();
    await c.notificacoes('52998224725');
    await c.infracoes('52998224725');
    await c.veiculos('52998224725');
    await c.cnh('52998224725');
    await c.pagamento('A0001001');
    await c.reconhecer('A0001001', {} as never, r);
    expect(
      (r as { status: ReturnType<typeof vi.fn> }).status,
    ).toHaveBeenCalledWith(201);
  });
});

describe('DetranController', () => {
  it('routes every endpoint and sets status for write results', async () => {
    const svc = svcProxy<DetranService>();
    const c = new DetranController(svc);
    const r = res();
    await c.consultarVeiculo('SP', {} as never, 'k', r);
    await c.consultarCondutor('SP', {} as never, 'k', r);
    await c.enviarAit('SP', {} as never, 'k', r);
    await c.consultarAit('SP', 'A0001001');
    await c.enviarSinistro('SP', {} as never, 'k', r);
    await c.enviarNotificacao('SP', {} as never, 'k', r);
    expect(
      (r as { status: ReturnType<typeof vi.fn> }).status,
    ).toHaveBeenCalledWith(201);
  });
});
