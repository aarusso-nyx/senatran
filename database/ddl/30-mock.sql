-- SENATRAN mock — control plane.

-- Authorized users for the x-cpf-usuario + x-client-cert-cn auth simulation.
create table mock.usuario_autorizado (
  cpf     text primary key,
  cert_cn text,
  nome    text,
  ativo   boolean not null default true
);

-- Reserved magic keys that force a status regardless of data (scenarios.md).
-- kind ∈ {placa, chassi, cpf, cnpj, renavam, cpf_usuario}.
create table mock.scenario_key (
  kind         text not null,
  key_value    text not null,
  force_status int  not null,
  message      text not null,
  primary key (kind, key_value)
);
