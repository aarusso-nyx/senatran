-- SENATRAN mock — SNE transactional tables (Sistema de Notificação Eletrônica).
-- National electronic-notification base: agencies deliver autuação/penalidade
-- notices to adherent vehicles/citizens through electronic channels. Ported as a
-- national extension (national-extensions-mapping.md, D-0011). Stateful:
-- `situacao` drives the delivery lifecycle; `payload` holds the resource object.

-- Adherence registry: who/what has opted into electronic delivery.
create table sne.adesao (
  tipo    text not null,          -- VEICULO | CIDADAO | ORGAO
  chave   text not null,          -- placa | cpf | codigoOrgaoAutuador
  aderido boolean not null default true,
  canal   text,                   -- APP_CDT | EMAIL | ...
  payload jsonb not null default '{}'::jsonb,
  primary key (tipo, chave)
);

create table sne.notificacao (
  protocolo             text primary key,
  numero_ait            text,
  id_processo           text,
  tipo_notificacao      text not null,   -- AUTUACAO | PENALIDADE
  codigo_orgao_autuador text,
  placa                 text,
  cpf_destinatario      text,
  situacao              text not null default 'ACEITA',  -- ACEITA | PENDENTE | REJEITADA | CANCELADA | EXPIRADA
  canal                 text,
  payload               jsonb not null default '{}'::jsonb
);
create index idx_sne_notif_cpf on sne.notificacao (cpf_destinatario);
create index idx_sne_notif_ait on sne.notificacao (numero_ait);
