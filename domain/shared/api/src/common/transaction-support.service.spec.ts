import { describe, expect, it, vi } from 'vitest';
import { TransactionSupport } from './transaction-support.service.js';
import { DatabaseStub } from '../../../../../tests/utils/database.stub.js';

describe('TransactionSupport', () => {
  it('replays the stored result without re-running fn', async () => {
    const db = new DatabaseStub();
    db.handler = (sql) =>
      sql.includes('from audit.idempotencia')
        ? { rows: [{ status_http: 201, resultado: { id: 'orig' } }] }
        : { rows: [] };
    const ts = new TransactionSupport(db);
    const fn = vi.fn();
    const out = await ts.idempotent('scope', 'key', fn as never);
    expect(out).toEqual({ status: 201, body: { id: 'orig' } });
    expect(fn).not.toHaveBeenCalled();
  });

  it('runs fn and persists the result on a first call', async () => {
    const db = new DatabaseStub();
    db.handler = (sql) =>
      sql.includes('from audit.idempotencia') ? { rows: [] } : { rows: [] };
    const ts = new TransactionSupport(db);
    const out = await ts.idempotent('scope', 'key', async () => ({
      status: 201,
      body: { id: 'new' },
    }));
    expect(out).toEqual({ status: 201, body: { id: 'new' } });
    const insert = db.find('insert into audit.idempotencia');
    expect(insert).toBeDefined();
    expect(insert?.params).toEqual([
      'scope',
      'key',
      201,
      JSON.stringify({ id: 'new' }),
    ]);
  });

  it('writes an audit event using the DB payload_hash function', async () => {
    const db = new DatabaseStub();
    const ts = new TransactionSupport(db);
    await ts.audit(db as never, {
      dominio: 'RENACH',
      entidade: 'renach.processo',
      entidadeId: 'RS1',
      tipoEvento: 'x.y',
      situacaoNova: 'APROVADO',
      payload: { a: 1 },
    });
    const call = db.find('insert into audit.evento');
    expect(call?.sql).toContain('audit.payload_hash($8::jsonb)');
    expect(call?.params?.[5]).toBe('APROVADO');
  });
});
