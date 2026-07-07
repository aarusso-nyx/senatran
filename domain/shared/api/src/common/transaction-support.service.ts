import { Inject, Injectable } from '@nestjs/common';
import { Database, type Transaction } from '../database/database.js';

/**
 * Cross-cutting support for transactional (RENACH/RENAINF) writes (INV-IDEMP-001):
 * idempotent execution keyed by a natural key or Idempotency-Key, and an audit
 * event per state transition with a SHA-256 payload hash. All within one tx.
 */
@Injectable()
export class TransactionSupport {
  constructor(@Inject(Database) private readonly db: Database) {}

  /** Write one audit.evento row for a state transition (uses the DB hash fn). */
  async audit(
    trx: Transaction,
    e: {
      dominio: string;
      entidade: string;
      entidadeId: string;
      tipoEvento: string;
      situacaoAnterior?: string | null;
      situacaoNova: string;
      cpfUsuario?: string;
      payload: unknown;
    },
  ): Promise<void> {
    await trx.query(
      `insert into audit.evento
         (dominio, entidade, entidade_id, tipo_evento, situacao_anterior, situacao_nova, cpf_usuario, payload, payload_hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb, audit.payload_hash($8::jsonb))`,
      [
        e.dominio,
        e.entidade,
        e.entidadeId,
        e.tipoEvento,
        e.situacaoAnterior ?? null,
        e.situacaoNova,
        e.cpfUsuario ?? null,
        JSON.stringify(e.payload),
      ],
    );
  }

  /**
   * Run a write. When the client supplied an `Idempotency-Key` (`chave`), a
   * replay returns the stored {status, body} without re-running `fn` — safe
   * retries. When no key is supplied (`chave` undefined), `fn` always runs, so
   * business rules like duplicate detection (RENAINF.AIT.DUPLICATED),
   * PENALTY.ALREADY_IMPOSED and PAYMENT.ALREADY_SETTLED fire normally. Either
   * way `fn` runs inside one transaction.
   */
  async idempotent<T>(
    escopo: string,
    chave: string | undefined,
    fn: (trx: Transaction) => Promise<{ status: number; body: T }>,
  ): Promise<{ status: number; body: T }> {
    if (!chave) return this.db.tx(fn);
    return this.db.tx(async (trx) => {
      const existing = await trx.query<{ status_http: number; resultado: T }>(
        'select status_http, resultado from audit.idempotencia where escopo = $1 and chave = $2',
        [escopo, chave],
      );
      if (existing.rows[0]) {
        return {
          status: existing.rows[0].status_http,
          body: existing.rows[0].resultado,
        };
      }
      const out = await fn(trx);
      await trx.query(
        'insert into audit.idempotencia (escopo, chave, status_http, resultado) values ($1,$2,$3,$4::jsonb)',
        [escopo, chave, out.status, JSON.stringify(out.body)],
      );
      return out;
    });
  }
}
