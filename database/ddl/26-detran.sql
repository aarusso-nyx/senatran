-- SENATRAN mock — State-DETRAN national-base bridge tables.
-- Models a state DETRAN acting AGAINST the national bases (RENAVAM/RENACH/
-- RENAINF/RENAEST/SNE) — NOT every UF-proprietary DETRAN API (see the boundary in
-- national-extensions-mapping.md, D-0011). Each UF has an integration profile;
-- each bridge call mints a `protocoloDetran` linked to a national protocol.

create table detran.perfil (
  uf                char(2) primary key,
  codigo_orgao      text,
  perfil_integracao text not null,            -- PRODUCAO | HOMOLOGACAO_PENDENTE
  versao_leiaute    text not null default '1.0',
  ativo             boolean not null default true,
  payload           jsonb not null default '{}'::jsonb
);

create table detran.bridge (
  protocolo_detran   text primary key,
  uf                 char(2) not null,
  sistema_nacional   text not null,           -- RENAVAM | RENACH | RENAINF | RENAEST | SNE
  protocolo_nacional text,
  numero_ait         text,
  situacao           text not null default 'ACEITO',   -- ACEITO | REJEITADO
  payload            jsonb not null default '{}'::jsonb
);
create index idx_detran_bridge_uf on detran.bridge (uf);

-- Mints protocoloDetran / protocoloNacional for bridge calls made at runtime.
create sequence if not exists detran.seq_bridge start with 70000000001;
