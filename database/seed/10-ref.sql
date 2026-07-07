-- SENATRAN mock seed — reference tables (generated).
insert into senatran.ref_uf (uf, nome) values
  ('AC', 'AC'),
  ('AL', 'AL'),
  ('AP', 'AP'),
  ('AM', 'AM'),
  ('BA', 'BA'),
  ('CE', 'CE'),
  ('DF', 'DF'),
  ('ES', 'ES'),
  ('GO', 'GO'),
  ('MA', 'MA'),
  ('MT', 'MT'),
  ('MS', 'MS'),
  ('MG', 'MG'),
  ('PA', 'PA'),
  ('PB', 'PB'),
  ('PR', 'PR'),
  ('PE', 'PE'),
  ('PI', 'PI'),
  ('RJ', 'RJ'),
  ('RN', 'RN'),
  ('RS', 'RS'),
  ('RO', 'RO'),
  ('RR', 'RR'),
  ('SC', 'SC'),
  ('SP', 'SP'),
  ('SE', 'SE'),
  ('TO', 'TO');

insert into senatran.ref_municipio (codigo, uf, nome) values
  ('3550308', 'SP', 'São Paulo'),
  ('3304557', 'RJ', 'Rio de Janeiro'),
  ('3106200', 'MG', 'Belo Horizonte'),
  ('4314902', 'RS', 'Porto Alegre'),
  ('4106902', 'PR', 'Curitiba'),
  ('2927408', 'BA', 'Salvador'),
  ('2304400', 'CE', 'Fortaleza'),
  ('5300108', 'DF', 'Brasília');

insert into senatran.ref_marca_modelo (codigo, descricao) values
  ('821001', 'VW/GOL 1.0'),
  ('815002', 'FIAT/UNO MILLE'),
  ('831003', 'GM/ONIX JOY'),
  ('844004', 'HYUNDAI/HB20'),
  ('852005', 'TOYOTA/COROLLA'),
  ('810006', 'FORD/KA SE'),
  ('868007', 'HONDA/CIVIC EXL'),
  ('877008', 'RENAULT/KWID ZEN');

insert into senatran.ref_cor (codigo, descricao) values
  ('1', 'AMARELO'),
  ('2', 'AZUL'),
  ('3', 'BRANCA'),
  ('4', 'CINZA'),
  ('5', 'PRETA'),
  ('6', 'PRATA'),
  ('7', 'VERDE'),
  ('8', 'VERMELHA');

insert into senatran.ref_especie (codigo, descricao) values
  ('1', 'PASSAGEIRO'),
  ('2', 'CARGA'),
  ('3', 'MISTO'),
  ('4', 'ESPECIAL'),
  ('5', 'TRACAO'),
  ('6', 'CORRIDA');

insert into senatran.ref_tipo_veiculo (codigo, descricao) values
  ('6', 'AUTOMOVEL'),
  ('4', 'CAMINHAO'),
  ('13', 'MOTOCICLETA'),
  ('8', 'CAMINHONETE'),
  ('14', 'ONIBUS'),
  ('23', 'UTILITARIO');

insert into senatran.ref_carroceria (codigo, descricao) values
  ('1', 'NAO APLICAVEL'),
  ('2', 'ABERTA'),
  ('3', 'FECHADA/BAU'),
  ('5', 'SEDAN'),
  ('6', 'HATCH');

insert into senatran.ref_categoria (codigo, descricao) values
  ('1', 'PARTICULAR'),
  ('2', 'ALUGUEL'),
  ('3', 'OFICIAL'),
  ('4', 'DIPLOMATICO'),
  ('5', 'APRENDIZAGEM');

insert into senatran.ref_combustivel (codigo, descricao) values
  ('1', 'ALCOOL'),
  ('2', 'GASOLINA'),
  ('3', 'DIESEL'),
  ('16', 'ALCOOL/GASOLINA'),
  ('17', 'GASOLINA/ELETRICO');

insert into senatran.ref_tipo_proprietario (codigo, descricao) values
  ('1', 'PESSOA FISICA'),
  ('2', 'PESSOA JURIDICA');

insert into senatran.ref_situacao_cnh (codigo, descricao) values
  ('A', 'ATIVA'),
  ('S', 'SUSPENSA'),
  ('C', 'CASSADA'),
  ('B', 'BLOQUEADA'),
  ('V', 'VENCIDA');

insert into senatran.ref_orgao_autuador (codigo, uf, nome) values
  ('204020', 'SP', 'DER/SP'),
  ('380090', 'RJ', 'DETRAN/RJ'),
  ('150070', 'MG', 'PMMG'),
  ('447010', 'RS', 'EPTC/POA'),
  ('999999', 'DF', 'PRF');

insert into senatran.ref_tipo_alteracao (codigo, descricao, codigo_sistema) values
  ('COR', 'Alteração de cor', 1),
  ('MOTOR', 'Troca de motor', 2),
  ('COMBUSTIVEL', 'Alteração de combustível', 3),
  ('CARROCERIA', 'Alteração de carroceria', 4),
  ('CATEGORIA', 'Mudança de categoria', 5);

