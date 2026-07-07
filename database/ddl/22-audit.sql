-- SENATRAN mock — shared audit + idempotency (INV-IDEMP-001).

-- One row per transactional state transition, with a SHA-256 payload hash.
create table audit.evento (
  id                uuid primary key default uuid_generate_v4(),
  dominio           text not null,          -- RENACH | RENAINF
  entidade          text not null,
  entidade_id       text not null,
  tipo_evento       text not null,          -- verb.noun
  situacao_anterior text,
  situacao_nova     text,
  cpf_usuario       text,
  payload           jsonb not null,
  payload_hash      text not null,
  criado_em         timestamptz not null default now()
);
create index idx_audit_entidade on audit.evento (entidade, entidade_id);

-- Idempotency ledger: a replay returns the original result (natural key or
-- Idempotency-Key header). escopo = "<operation>", chave = natural key / header.
create table audit.idempotencia (
  escopo     text not null,
  chave      text not null,
  status_http int not null,
  resultado  jsonb not null,
  criado_em  timestamptz not null default now(),
  primary key (escopo, chave)
);

-- Helper: compute the canonical payload hash used across the audit trail.
create or replace function audit.payload_hash(p jsonb)
returns text language sql immutable as $$
  select encode(digest(convert_to(p::text, 'UTF8'), 'sha256'), 'hex');
$$;
