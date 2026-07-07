-- SENATRAN mock — read-side entity tables (WSDenatran).
-- D-0010: each row is <key columns> + payload jsonb (the exact contract object,
-- generated from the OpenAPI schema). `id bigserial` backs the idUltimoRegistro
-- cursor. Contract views (90-contract-read.sql) select payload and wrap envelopes.

-- Veículo (schema Veiculo). Owner + indicators denormalized as columns.
create table senatran.veiculo (
  id                 bigserial primary key,
  chassi             text not null unique,
  placa              text not null,
  codigo_renavam     text not null,
  numero_motor       text,
  numero_cambio      text,
  id_proprietario    text,          -- numeroIdentificacaoProprietario
  tipo_proprietario  text,          -- codigoTipoProprietario
  ind_alarme         boolean not null default false,
  ind_roubo_furto    boolean not null default false,
  ind_transferencia  boolean not null default false,
  ind_licenciamento  boolean not null default false,
  ind_circulacao     boolean not null default false,
  ind_penhora        boolean not null default false,
  ind_media_monta    boolean not null default false,
  ind_grande_monta   boolean not null default false,
  ind_recuperado     boolean not null default false,
  payload            jsonb not null
);
create index idx_veiculo_placa   on senatran.veiculo (placa);
create index idx_veiculo_renavam on senatran.veiculo (codigo_renavam);
create index idx_veiculo_motor   on senatran.veiculo (numero_motor);
create index idx_veiculo_cambio  on senatran.veiculo (numero_cambio);
create index idx_veiculo_prop    on senatran.veiculo (id_proprietario, tipo_proprietario);

-- Condutor (schema Condutor).
create table senatran.condutor (
  id                        bigserial primary key,
  cpf                       text not null,
  numero_registro           text,
  numero_formulario_renach  text,
  numero_lista_impedimento  text,
  numero_pgu                text,
  numero_formulario_pid     text,
  nome                      text,
  data_nascimento           date,
  nome_mae                  text,
  payload                   jsonb not null
);
create index idx_condutor_cpf        on senatran.condutor (cpf);
create index idx_condutor_registro   on senatran.condutor (numero_registro);
create index idx_condutor_renach     on senatran.condutor (numero_formulario_renach);
create index idx_condutor_impedimento on senatran.condutor (numero_lista_impedimento);
create index idx_condutor_pgu        on senatran.condutor (numero_pgu);
create index idx_condutor_pid        on senatran.condutor (numero_formulario_pid);
create index idx_condutor_ident      on senatran.condutor (nome, data_nascimento, nome_mae);

-- Imagem/retrato/validação da CNH (schema CondutorImagem).
create table senatran.condutor_imagem (
  id               bigserial primary key,
  cpf              text not null,
  numero_registro  text not null,
  numero_seguranca text not null,
  payload          jsonb not null,
  unique (cpf, numero_registro, numero_seguranca)
);

-- Extrato de infrações do condutor (item schema CondutorInfracaoExtratoItem).
create table senatran.condutor_infracao_item (
  id                  bigserial primary key,
  numero_registro_cnh text not null,
  payload             jsonb not null
);
create index idx_cond_infr_item_reg on senatran.condutor_infracao_item (numero_registro_cnh);

-- Infração (schema Infracao).
create table senatran.infracao (
  id                        bigserial primary key,
  auto_infracao             text,
  codigo_orgao_autuador     text,
  codigo_infracao           text,
  codigo_renainf            text,
  cpf                       text,
  cnpj                      text,
  numero_registro_cnh       text,
  numero_pgu                text,
  uf                        text,
  placa                     text,
  situacao_exigibilidade    text,
  identificacao_hab_estr    text,
  payload                   jsonb not null
);
create index idx_infracao_ait     on senatran.infracao (auto_infracao, codigo_orgao_autuador, codigo_infracao);
create index idx_infracao_cpf     on senatran.infracao (cpf);
create index idx_infracao_cnpj    on senatran.infracao (cnpj);
create index idx_infracao_reg     on senatran.infracao (numero_registro_cnh);
create index idx_infracao_pgu     on senatran.infracao (numero_pgu, uf);
create index idx_infracao_placa   on senatran.infracao (placa, situacao_exigibilidade);
create index idx_infracao_renainf on senatran.infracao (codigo_renainf);
create index idx_infracao_habestr on senatran.infracao (identificacao_hab_estr);

-- Ocorrências / pagamentos de infração (keyed by AIT triple).
create table senatran.infracao_ocorrencia (
  id                    bigserial primary key,
  auto_infracao         text not null,
  codigo_orgao_autuador text not null,
  codigo_infracao       text not null,
  payload               jsonb not null
);
create index idx_infr_ocor_ait on senatran.infracao_ocorrencia (auto_infracao, codigo_orgao_autuador, codigo_infracao);

create table senatran.infracao_pagamento (
  id                    bigserial primary key,
  auto_infracao         text not null,
  codigo_orgao_autuador text not null,
  codigo_infracao       text not null,
  payload               jsonb not null
);
create index idx_infr_pag_ait on senatran.infracao_pagamento (auto_infracao, codigo_orgao_autuador, codigo_infracao);

-- Restrições judiciais ativas (item schema RestricaoJudicialProcesso).
create table senatran.restricao_judicial_processo (
  id      bigserial primary key,
  placa   text not null,
  renavam text,
  payload jsonb not null
);
create index idx_restr_jud_placa on senatran.restricao_judicial_processo (placa, renavam);

-- Roubo/furto em aberto (item schema RouboFurtoOcorrencia).
create table senatran.roubo_furto_ocorrencia (
  id      bigserial primary key,
  placa   text,
  chassi  text,
  payload jsonb not null
);
create index idx_rf_placa  on senatran.roubo_furto_ocorrencia (placa);
create index idx_rf_chassi on senatran.roubo_furto_ocorrencia (chassi);

-- Código de segurança CRV (schema CodigoSegurancaCrv).
create table senatran.csv_seguranca (
  id                  bigserial primary key,
  codigo_seguranca_crv text not null,
  cpf                 text,
  cnpj                text,
  renavam             text,
  placa               text,
  payload             jsonb not null
);
create index idx_csv_seg on senatran.csv_seguranca (codigo_seguranca_crv, renavam, placa);

-- Consulta CSV integrador (schema ConsultaCsv).
create table senatran.consulta_csv (
  id      bigserial primary key,
  chassi  text,
  placa   text,
  payload jsonb not null
);
create index idx_consulta_csv_chassi on senatran.consulta_csv (chassi);
create index idx_consulta_csv_placa  on senatran.consulta_csv (placa);

-- Comunicação de venda (schema ComunicacaoVenda).
create table senatran.comunicacao_venda (
  id      bigserial primary key,
  cpf     text,
  cnpj    text,
  renavam text,
  placa   text,
  payload jsonb not null
);
create index idx_com_venda on senatran.comunicacao_venda (renavam, placa);

-- Endereço do possuidor (schema EnderecoPossuidor).
create table senatran.endereco_possuidor (
  id      bigserial primary key,
  placa   text not null,
  renavam text,
  payload jsonb not null
);
create index idx_end_poss on senatran.endereco_possuidor (placa, renavam);

-- Multa interestadual (schema MultaInterestadualResponse).
create table senatran.multa_interestadual (
  id      bigserial primary key,
  cpf     text,
  cnpj    text,
  renavam text,
  placa   text,
  payload jsonb not null
);
create index idx_multa_inter on senatran.multa_interestadual (renavam, placa);

-- Recalls em aberto (schema RecallResponse).
create table senatran.recall (
  id      bigserial primary key,
  chassi  text not null,
  payload jsonb not null
);
create index idx_recall_chassi on senatran.recall (chassi);

-- Alterações permitidas (schema AlteracaoPermitida) — static list.
create table senatran.alteracao_permitida (
  id      bigserial primary key,
  payload jsonb not null
);
