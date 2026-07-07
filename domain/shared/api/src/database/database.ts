import { Pool, type PoolClient } from 'pg';

/** Connection options for {@link PgDatabase}, decoupled from the app config. */
export interface PgDatabaseOptions {
  connectionString: string;
  ssl: boolean;
  queryTimeoutMs: number;
}

/** Minimal query-result shape, aligned with `pg` and easy to stub in tests. */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/** A handle usable inside a transaction. */
export interface Transaction {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
}

/**
 * Database abstraction the whole app depends on. Thin services issue a single
 * `query()` against a prepared contract view. `tx()` exists for the rare
 * multi-statement path and to keep parity with the sibling `@stynx/data` shape
 * so tests can substitute a stub.
 */
export abstract class Database {
  abstract query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;

  abstract tx<T>(
    fn: (trx: Transaction) => Promise<T>,
    options?: { readonly?: boolean },
  ): Promise<T>;
}

/** Production implementation backed by a `pg` connection pool. */
export class PgDatabase extends Database {
  private readonly pool: Pool;

  constructor(options: PgDatabaseOptions) {
    super();
    this.pool = new Pool({
      connectionString: options.connectionString,
      ssl: options.ssl ? { rejectUnauthorized: false } : undefined,
      query_timeout: options.queryTimeoutMs,
      statement_timeout: options.queryTimeoutMs,
    });
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const result = await this.pool.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }

  async tx<T>(
    fn: (trx: Transaction) => Promise<T>,
    options: { readonly?: boolean } = {},
  ): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query(options.readonly ? 'begin read only' : 'begin');
      const trx: Transaction = {
        query: async (sql, params = []) => {
          const r = await client.query(sql, params);
          return { rows: r.rows, rowCount: r.rowCount ?? 0 };
        },
      };
      const out = await fn(trx);
      await client.query('commit');
      return out;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
