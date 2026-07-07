import { Inject, Injectable } from '@nestjs/common';
import { Database } from '../database/database.js';
import { ScenarioService } from './scenario.service.js';
import { notFound, WsdenatranError } from './wsdenatran-error.js';

/** Maps a key column to its scenario-key `kind` (for forced-status lookup). */
const COL_KIND: Record<string, string> = {
  placa: 'placa',
  chassi: 'chassi',
  cpf: 'cpf',
  cnpj: 'cnpj',
  renavam: 'renavam',
  codigo_renavam: 'renavam',
};

/** Default page size for cursor pagination. */
const PAGE_SIZE = 100;

/**
 * Per-base-table envelope for paginated list endpoints: the returned-count field,
 * the total-count field, and the array key — matching each response schema.
 */
const ENVELOPES: Record<
  string,
  { returned: string; real: string; arrayKey: string }
> = {
  veiculo: {
    returned: 'quantidadeVeiculo',
    real: 'quantidadeVeiculoReal',
    arrayKey: 'veiculo',
  },
  infracao: {
    returned: 'quantidadeInfracoes',
    real: 'quantidadeInfracoesReal',
    arrayKey: 'infracoes',
  },
  restricao_judicial_processo: {
    returned: 'quantidadeRetornada',
    real: 'quantidadeReal',
    arrayKey: 'processos',
  },
  roubo_furto_ocorrencia: {
    returned: 'quantidadeRetornada',
    real: 'quantidadeReal',
    arrayKey: 'ocorrenciasRouboFurto',
  },
};

/**
 * The read seam for WSDenatran endpoints. `one()` returns a prepared
 * `contract.*` view's payload (single object / boolean / static list). `list()`
 * serves cursor-paginated collections directly from the base table, honoring the
 * `idUltimoRegistro` cursor and building the correct envelope. Both apply forced
 * scenario keys first (scenarios.md); an empty result is a 404.
 */
@Injectable()
export class ReadService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(ScenarioService) private readonly scenario: ScenarioService,
  ) {}

  private async scenarioCheck(keys: Record<string, string>): Promise<void> {
    for (const [col, val] of Object.entries(keys)) {
      const kind = COL_KIND[col];
      if (kind) {
        const forced = await this.scenario.forced(kind, val);
        if (forced) throw new WsdenatranError(forced.status, forced.message);
      }
    }
  }

  /** Single-object / boolean / static-list endpoints via a prepared view. */
  async one(view: string, keys: Record<string, string> = {}): Promise<unknown> {
    await this.scenarioCheck(keys);
    const cols = Object.keys(keys);
    const where = cols.length
      ? ' where ' + cols.map((c, i) => `${c} = $${i + 1}`).join(' and ')
      : '';
    const result = await this.db.query<{ payload: unknown }>(
      `select payload from contract.${view}${where}`,
      Object.values(keys),
    );
    if (result.rows.length === 0) throw notFound();
    return result.rows[0].payload;
  }

  /**
   * Cursor-paginated list from a base table. Returns the envelope with the page
   * of items (id > cursor, ordered by id, limited to PAGE_SIZE), total real
   * count, and idUltimoRegistro (the last id in the page).
   */
  async list(
    table: string,
    keys: Record<string, string>,
    cursor?: string,
  ): Promise<unknown> {
    const env = ENVELOPES[table];
    if (!env) throw new WsdenatranError(500, `unknown list table ${table}`);
    await this.scenarioCheck(keys);

    const cols = Object.keys(keys);
    const where = cols.map((c, i) => `${c} = $${i + 1}`).join(' and ');
    const params = Object.values(keys);

    const totalR = await this.db.query<{ n: number }>(
      `select count(*)::int as n from senatran.${table} where ${where}`,
      params,
    );
    const total = totalR.rows[0]?.n ?? 0;
    if (total === 0) throw notFound();

    const pageParams: unknown[] = [...params];
    let cursorClause = '';
    if (
      cursor !== undefined &&
      cursor !== '' &&
      Number.isFinite(Number(cursor))
    ) {
      pageParams.push(Number(cursor));
      cursorClause = ` and id > $${pageParams.length}`;
    }
    const pageR = await this.db.query<{ id: number; payload: unknown }>(
      `select id, payload from senatran.${table} where ${where}${cursorClause} order by id limit ${PAGE_SIZE}`,
      pageParams,
    );
    const items = pageR.rows.map((r) => r.payload);
    // pg returns bigint ids as strings; the contract declares idUltimoRegistro
    // as int64, so coerce to a number to honor it.
    const lastId = pageR.rows.length
      ? Number(pageR.rows[pageR.rows.length - 1].id)
      : Number(cursor ?? 0);

    return {
      [env.returned]: items.length,
      [env.real]: total,
      idUltimoRegistro: lastId,
      [env.arrayKey]: items,
    };
  }
}
