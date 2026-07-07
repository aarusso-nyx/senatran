import {
  Database,
  type QueryResult,
  type Transaction,
} from '../../domain/shared/api/src/database/database.js';

type Handler = (
  sql: string,
  params: unknown[],
) =>
  | { rows: unknown[]; rowCount?: number }
  | Promise<{ rows: unknown[]; rowCount?: number }>;

/**
 * In-memory Database for unit tests. `handler` decides what each query returns
 * (match on the SQL text). `tx` runs the callback with a transaction that
 * delegates to the same handler. `calls` records every query for assertions.
 */
export class DatabaseStub extends Database {
  handler: Handler = () => ({ rows: [] });
  readonly calls: { sql: string; params: unknown[] }[] = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    this.calls.push({ sql, params });
    const r = await this.handler(sql, params);
    return { rows: r.rows as T[], rowCount: r.rowCount ?? r.rows.length };
  }

  async tx<T>(fn: (trx: Transaction) => Promise<T>): Promise<T> {
    const trx: Transaction = {
      query: (sql, params = []) => this.query(sql, params),
    };
    return fn(trx);
  }

  /** Convenience: last query whose SQL matches a substring. */
  find(substr: string): { sql: string; params: unknown[] } | undefined {
    return [...this.calls].reverse().find((c) => c.sql.includes(substr));
  }
}
