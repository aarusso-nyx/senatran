-- SENATRAN mock — RENAEST transactional tables (national crash/sinister base).
-- RENAEST is the Registro Nacional de Acidentes e Estatísticas de Trânsito: a
-- national base that receives crash/sinister records from state DETRANs and
-- other agencies. Ported into WSDenatran conventions as a national extension
-- (national-extensions-mapping.md, D-0011). Stateful like RENACH/RENAINF:
-- `situacao` drives the record lifecycle; `payload` holds the resource object
-- returned by the read-back views.

create table renaest.sinistro (
  id_sinistro        text primary key,
  protocolo          text not null unique,
  -- Natural dedup key: a crash is uniquely a (uf, município, instante, órgão).
  -- A second submit of the same tuple without an Idempotency-Key is DUPLICATED.
  chave_natural      text not null,
  situacao           text not null default 'RECEBIDO',  -- RECEBIDO | EM_ANALISE | CONSOLIDADO | REJEITADO
  uf                 char(2) not null,
  codigo_municipio   text not null,
  data_hora_sinistro timestamptz not null,
  gravidade          text,
  orgao_responsavel  text,
  -- Cross-links to the other national bases (nullable), so a crash can reference
  -- an existing vehicle (RENAVAM), driver (RENACH/condutor) or infraction (AIT).
  renavam            text,
  cpf_condutor       text,
  numero_ait         text,
  payload            jsonb not null default '{}'::jsonb
);
create index idx_renaest_sinistro_protocolo on renaest.sinistro (protocolo);
create index idx_renaest_sinistro_chave on renaest.sinistro (chave_natural);
create index idx_renaest_sinistro_renavam on renaest.sinistro (renavam);

-- Mints idSinistro for crashes submitted at runtime (POST /v1/renaest/sinistros).
-- Starts high so minted ids never collide with the seeded SN########### set.
create sequence if not exists renaest.seq_sinistro start with 70000000001;

-- One row per complement/correction submitted against an existing crash record.
create table renaest.retificacao (
  id          uuid primary key default uuid_generate_v4(),
  id_sinistro text not null references renaest.sinistro(id_sinistro),
  protocolo   text not null,
  tipo        text not null,                    -- COMPLEMENTO | CORRECAO
  situacao    text not null default 'EM_ANALISE',
  payload     jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now()
);
create index idx_renaest_retif_sinistro on renaest.retificacao (id_sinistro);
