import { describe, expect, it } from 'vitest';
import { DetranService } from './detran.service.js';
import { TransactionSupport } from '../../../shared/api/src/common/transaction-support.service.js';
import { ScenarioService } from '../../../shared/api/src/common/scenario.service.js';
import { DatabaseStub } from '../../../../tests/utils/database.stub.js';

type Handler = (sql: string) => { rows: unknown[] };
type Forced = { status: number; message: string } | null;

const make = (handler: Handler, forced: Forced = null) => {
  const db = new DatabaseStub();
  db.handler = (sql) => handler(sql);
  const scenario = { forced: async () => forced } as unknown as ScenarioService;
  return {
    db,
    svc: new DetranService(db, new TransactionSupport(db), scenario),
  };
};

const perfilRow = (over: Record<string, unknown> = {}) => ({
  uf: 'SP',
  codigo_orgao: '204020',
  perfil_integracao: 'PRODUCAO',
  versao_leiaute: '1.0',
  ativo: true,
  ...over,
});

const flow =
  (perfil: Record<string, unknown> | null): Handler =>
  (sql) => {
    if (sql.includes('from detran.perfil'))
      return { rows: perfil ? [perfil] : [] };
    if (sql.includes('nextval')) return { rows: [{ n: '00000000001' }] };
    return { rows: [] };
  };

describe('DetranService', () => {
  it('bridge → 201 with linked protocols on an active profile', async () => {
    const { svc } = make(flow(perfilRow()));
    const out = await svc.consultarVeiculo('SP', { placa: 'ABC1D23' }, 'k1');
    expect(out.status).toBe(201);
    const b = out.body as Record<string, unknown>;
    expect(b.protocoloDetran).toMatch(/^DTR-SP-/);
    expect(b.protocoloNacional).toMatch(/^RENAVAM-/);
    expect(b.situacao).toBe('ACEITO');
  });

  it('bridge → 404 DETRAN.PROFILE.NOT_FOUND for an unknown UF', async () => {
    const { svc } = make(flow(null));
    await expect(
      svc.consultarVeiculo('AC', { placa: 'ABC1D23' }, 'k2'),
    ).rejects.toMatchObject({ returnCode: 404 });
  });

  it('bridge → 402 DETRAN.PROFILE.INACTIVE', async () => {
    const { svc } = make(flow(perfilRow({ ativo: false })));
    await expect(
      svc.consultarVeiculo('RJ', { placa: 'ABC1D23' }, 'k3'),
    ).rejects.toMatchObject({ returnCode: 402 });
  });

  it('bridge → 400 DETRAN.LAYOUT.INVALID on a version mismatch', async () => {
    const { svc } = make(flow(perfilRow()));
    await expect(
      svc.consultarVeiculo('SP', { versaoLeiaute: '9.9' }, 'k4'),
    ).rejects.toMatchObject({ returnCode: 400 });
  });

  it('bridge → 402 DETRAN.BRIDGE.REJECTED in homologation', async () => {
    const { svc } = make(
      flow(perfilRow({ perfil_integracao: 'HOMOLOGACAO_PENDENTE' })),
    );
    await expect(
      svc.consultarVeiculo('BA', { placa: 'ABC1D23' }, 'k5'),
    ).rejects.toMatchObject({ returnCode: 402 });
  });

  it('bridge → forwards a forced 500 magic UF', async () => {
    const { svc } = make(flow(perfilRow()), { status: 500, message: 'x' });
    await expect(
      svc.consultarVeiculo('ZZ', { placa: 'ABC1D23' }, 'k6'),
    ).rejects.toMatchObject({ returnCode: 500 });
  });

  it('consultarAit → returns the seeded bridge payload when present', async () => {
    const { svc } = make((sql) => {
      if (sql.includes('from detran.perfil')) return { rows: [perfilRow()] };
      if (sql.includes('from detran.bridge'))
        return { rows: [{ payload: { protocoloDetran: 'DTR-SP-1' } }] };
      return { rows: [] };
    });
    await expect(svc.consultarAit('SP', 'A0001001')).resolves.toMatchObject({
      protocoloDetran: 'DTR-SP-1',
    });
  });

  it('consultarAit → 404 when neither bridge nor national AIT exists', async () => {
    const { svc } = make((sql) =>
      sql.includes('from detran.perfil')
        ? { rows: [perfilRow()] }
        : { rows: [] },
    );
    await expect(svc.consultarAit('SP', 'AX')).rejects.toMatchObject({
      returnCode: 404,
    });
  });
});
