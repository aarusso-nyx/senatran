-- SENATRAN mock — RENAINF transactional tables (infraction lifecycle).

create table renainf.dispositivo (
  id_dispositivo        text primary key,
  codigo_orgao_autuador text not null,
  homologado            boolean not null default true,
  ativo                 boolean not null default true,
  sne_aderido           boolean not null default true, -- órgão aderente ao SNE
  payload               jsonb not null default '{}'::jsonb
);

create table renainf.faixa_ait (
  id                    bigserial primary key,
  codigo_orgao_autuador text not null,
  numero_inicial        text not null,
  numero_final          text not null,
  reservada             boolean not null default true
);

create table renainf.ait (
  id                    uuid primary key default uuid_generate_v4(),
  numero_ait            text not null unique,
  codigo_orgao_autuador text not null,
  situacao              text not null default 'RASCUNHO',
  placa                 text,
  codigo_infracao       text not null,
  data_infracao         timestamptz not null,
  cpf_agente            text,
  id_dispositivo        text,
  payload               jsonb not null
);
create index idx_renainf_ait_placa on renainf.ait (placa);

create table renainf.processo (
  id           uuid primary key default uuid_generate_v4(),
  ait_id       uuid not null references renainf.ait(id),
  situacao     text not null default 'AUTUACAO_ABERTA',
  prazo_defesa timestamptz, -- deadline for a tempestive prévia defense (set on notice)
  payload      jsonb not null default '{}'::jsonb
);
create index idx_renainf_processo_ait on renainf.processo (ait_id);

create table renainf.indicacao_condutor (
  id           bigserial primary key,
  processo_id  uuid not null references renainf.processo(id),
  cpf_condutor text not null,
  data         timestamptz not null default now(),
  payload      jsonb not null default '{}'::jsonb
);

create table renainf.defesa (
  id             bigserial primary key,
  processo_id    uuid not null references renainf.processo(id),
  tipo_requerente text not null,
  numero_documento text not null,
  fundamentacao  text,
  data_protocolo timestamptz not null default now(),
  resultado      text,                   -- ACEITA | REJEITADA | null
  payload        jsonb not null default '{}'::jsonb
);

create table renainf.penalidade (
  id            bigserial primary key,
  processo_id   uuid not null references renainf.processo(id),
  valor         numeric(10,2),
  pontos        int,
  data_imposicao timestamptz not null default now(),
  payload       jsonb not null default '{}'::jsonb
);

create table renainf.recurso (
  id                uuid primary key default uuid_generate_v4(),
  processo_id       uuid not null references renainf.processo(id),
  instancia         text not null,       -- JARI | SEGUNDA_INSTANCIA
  id_recurso_anterior uuid,
  situacao          text not null default 'APRESENTADO',
  resultado         text,                -- PROVIDO | NEGADO | null
  payload           jsonb not null default '{}'::jsonb
);
create index idx_renainf_recurso_proc on renainf.recurso (processo_id);

create table renainf.debito (
  processo_id       uuid primary key references renainf.processo(id),
  valor             numeric(10,2) not null,
  situacao_pagamento text not null default 'EM_ABERTO',
  data_vencimento   date,
  payload           jsonb not null default '{}'::jsonb
);

create table renainf.pagamento (
  id                bigserial primary key,
  processo_id       uuid not null references renainf.processo(id),
  valor_pago        numeric(10,2) not null,
  data_pagamento    timestamptz not null default now(),
  forma_pagamento   text,
  numero_comprovante text,
  payload           jsonb not null default '{}'::jsonb
);
