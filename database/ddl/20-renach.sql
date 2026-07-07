-- SENATRAN mock — RENACH transactional tables (driver-licensing exams).
-- Stateful: `situacao` drives the state machine (renach-renainf-workflows.md);
-- `payload` holds the current resource object returned by read-back views.

create table renach.processo (
  id                  uuid primary key default uuid_generate_v4(),
  numero_renach       text not null unique,
  cpf                 text not null,
  tipo_processo       text not null,
  situacao            text not null default 'ABERTO',
  categoria_atual     text,
  categoria_pretendida text,
  data_abertura       timestamptz not null default now(),
  data_expiracao      timestamptz,
  payload             jsonb not null default '{}'::jsonb
);
create index idx_renach_processo_cpf on renach.processo (cpf);

create table renach.clinica (
  codigo_clinica text primary key,
  cnpj           text not null,
  nome           text not null,
  uf             char(2) not null,
  credenciada    boolean not null default true,
  ativa          boolean not null default true,
  payload        jsonb not null default '{}'::jsonb
);

create table renach.profissional (
  cpf            text primary key,
  conselho       text not null,          -- CRM | CRP
  numero_conselho text not null,
  uf             char(2) not null,
  codigo_clinica text references renach.clinica(codigo_clinica),
  credenciado    boolean not null default true,
  ativo          boolean not null default true,
  payload        jsonb not null default '{}'::jsonb
);

create table renach.agendamento (
  id             uuid primary key default uuid_generate_v4(),
  numero_renach  text not null references renach.processo(numero_renach),
  data_hora      timestamptz not null,
  codigo_clinica text,
  situacao       text not null default 'AGENDADO',  -- AGENDADO | REMARCADO | CANCELADO | CHECKIN
  payload        jsonb not null default '{}'::jsonb
);
create index idx_renach_agend_renach on renach.agendamento (numero_renach);

create table renach.exame (
  id             uuid primary key default uuid_generate_v4(),
  numero_renach  text not null references renach.processo(numero_renach),
  tipo_exame     text not null,          -- MEDICO | PSICOLOGICO
  resultado      text not null,
  codigo_clinica text,
  cpf_examinador text,
  data_realizacao timestamptz,
  data_validade  date,
  payload        jsonb not null
);
create index idx_renach_exame_renach on renach.exame (numero_renach);

create table renach.exame_restricao (
  id        bigserial primary key,
  exame_id  uuid not null references renach.exame(id) on delete cascade,
  codigo    text not null,
  descricao text
);

create table renach.junta (
  id            uuid primary key default uuid_generate_v4(),
  numero_renach text not null references renach.processo(numero_renach),
  tipo          text not null,           -- ENCAMINHAMENTO | PARECER
  situacao      text not null default 'ABERTA',
  payload       jsonb not null default '{}'::jsonb
);
create index idx_renach_junta_renach on renach.junta (numero_renach);
