-- SENATRAN mock — reference (código↔descrição) tables. Structure only; the
-- deterministic generator seeds them (database/seed/) from the same curated lists
-- it bakes into entity payloads, so codes are coherent (INV-DATA-001).
create table senatran.ref_uf            (uf char(2) primary key, nome text not null);
create table senatran.ref_municipio     (codigo text primary key, uf char(2) not null, nome text not null);
create table senatran.ref_marca_modelo  (codigo text primary key, descricao text not null);
create table senatran.ref_cor           (codigo text primary key, descricao text not null);
create table senatran.ref_especie       (codigo text primary key, descricao text not null);
create table senatran.ref_tipo_veiculo  (codigo text primary key, descricao text not null);
create table senatran.ref_carroceria    (codigo text primary key, descricao text not null);
create table senatran.ref_categoria     (codigo text primary key, descricao text not null);
create table senatran.ref_combustivel   (codigo text primary key, descricao text not null);
create table senatran.ref_tipo_proprietario (codigo text primary key, descricao text not null);
create table senatran.ref_orgao_autuador (codigo text primary key, uf char(2) not null, nome text not null);
create table senatran.ref_situacao_cnh  (codigo text primary key, descricao text not null);
create table senatran.ref_tipo_alteracao (codigo text primary key, descricao text not null, codigo_sistema int not null);
