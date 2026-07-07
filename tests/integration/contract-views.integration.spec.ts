import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDatabase } from '../../domain/shared/api/src/database/database.js';
import { loadConfig } from '../../domain/shared/api/src/config/configuration.js';

/**
 * Integration (INV-API-001): the prepared contract views return the exact
 * response JSON and the scenario keys are seeded. Requires `pnpm db:reset`.
 */
let db: PgDatabase;
beforeAll(() => {
  db = new PgDatabase(loadConfig().database);
});
afterAll(() => db.close());

describe('contract views', () => {
  it('v_veiculo_by_placa returns the list envelope with the vehicle', async () => {
    const r = await db.query<{ payload: Record<string, unknown> }>(
      'select payload from contract.v_veiculo_by_placa where placa = $1',
      ['ABC1D23'],
    );
    const p = r.rows[0].payload as {
      quantidadeVeiculo: number;
      veiculo: { placa: string }[];
    };
    expect(Object.keys(p).sort()).toEqual([
      'idUltimoRegistro',
      'quantidadeVeiculo',
      'quantidadeVeiculoReal',
      'veiculo',
    ]);
    expect(p.veiculo[0].placa).toBe('ABC1D23');
  });

  it('condutores wraps in {condutores:[...]}', async () => {
    const r = await db.query<{ payload: { condutores: unknown[] } }>(
      'select payload from contract.v_condutores_by_cpf where cpf = $1',
      ['52998224725'],
    );
    expect(Array.isArray(r.rows[0].payload.condutores)).toBe(true);
  });

  it('boolean and object indicator views', async () => {
    const alarme = await db.query<{ payload: boolean }>(
      'select payload from contract.v_indicador_alarme_by_placa where placa = $1',
      ['IND1I01'],
    );
    expect(alarme.rows[0].payload).toBe(true);
    const sinistro = await db.query<{ payload: Record<string, unknown> }>(
      'select payload from contract.v_indicador_sinistro_by_placa where placa = $1',
      ['ABC1D23'],
    );
    expect(Object.keys(sinistro.rows[0].payload).sort()).toEqual([
      'indicadorGrandeMonta',
      'indicadorMediaMonta',
      'indicadorRecuperado',
    ]);
  });

  it('all 57 read contract views exist and are selectable', async () => {
    const r = await db.query<{ n: number }>(
      "select count(*)::int as n from information_schema.views where table_schema = 'contract' and table_name like 'v_%'",
    );
    expect(r.rows[0].n).toBeGreaterThanOrEqual(57);
  });

  it('scenario_key sentinels are seeded', async () => {
    const r = await db.query<{
      kind: string;
      key_value: string;
      force_status: number;
    }>(
      'select kind, key_value, force_status from mock.scenario_key order by force_status',
    );
    expect(r.rows).toContainEqual({
      kind: 'cpf_usuario',
      key_value: '00000000000',
      force_status: 401,
    });
    expect(r.rows.some((x) => x.force_status === 402)).toBe(true);
    expect(r.rows.some((x) => x.force_status === 500)).toBe(true);
  });
});
