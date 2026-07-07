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

/**
 * The single seam every read (WSDenatran) service uses. Runs one parameterized
 * query against a prepared `contract.*` view and returns its `payload`. Applies
 * forced scenario keys before the query (scenarios.md); an empty result is a 404.
 * Controllers/services contain no other logic (D-0003).
 */
@Injectable()
export class ReadService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(ScenarioService) private readonly scenario: ScenarioService,
  ) {}

  /**
   * @param view  contract view name, e.g. 'v_veiculo_by_placa'
   * @param keys  ordered map of key column → value (WHERE `col = $n`)
   */
  async one(view: string, keys: Record<string, string> = {}): Promise<unknown> {
    for (const [col, val] of Object.entries(keys)) {
      const kind = COL_KIND[col];
      if (kind) {
        const forced = await this.scenario.forced(kind, val);
        if (forced) throw new WsdenatranError(forced.status, forced.message);
      }
    }
    const cols = Object.keys(keys);
    const where = cols.length
      ? ' where ' + cols.map((c, i) => `${c} = $${i + 1}`).join(' and ')
      : '';
    const sql = `select payload from contract.${view}${where}`;
    const result = await this.db.query<{ payload: unknown }>(
      sql,
      Object.values(keys),
    );
    if (result.rows.length === 0) throw notFound();
    return result.rows[0].payload;
  }
}
