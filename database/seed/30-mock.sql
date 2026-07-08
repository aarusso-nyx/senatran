-- SENATRAN mock seed — control plane (generated).
insert into mock.usuario_autorizado (cpf, cert_cn, nome, ativo) values
  ('12345678909', 'senatran-dev-client', 'Usuário Dev', true),
  ('52998224725', 'senatran-dev-client', 'Fixture', true);

insert into mock.scenario_key (kind, key_value, force_status, message) values
  ('cpf_usuario', '00000000000', 401, '401 → Não autorizado: CPF de usuário reservado.'),
  ('placa', 'ERR2A02', 402, '402 → RENAINF.CASE.INVALID_STATUS — cenário de erro de negócio reservado.'),
  ('chassi', 'ERR00000000000402', 402, '402 → erro de negócio reservado.'),
  ('cpf', '00000000402', 402, '402 → erro de negócio reservado.'),
  ('cnpj', '00000000000402', 402, '402 → erro de negócio reservado.'),
  ('renavam', '00000000402', 402, '402 → erro de negócio reservado.'),
  ('codigoMunicipio', '9999999', 500, '500 → RENAEST: fonte nacional indisponível (erro interno reservado). Use como codigoMunicipio ao submeter um sinistro.'),
  ('codigoOrgaoAutuador', '999999', 500, '500 → SNE/DETRAN: órgão autuador reservado (fonte indisponível).'),
  ('numeroAit', 'A0000500', 500, '500 → CDT: AIT reservado (fonte indisponível). Use em /v1/cdt/infracoes/{numeroAit}/*.'),
  ('uf', 'ZZ', 500, '500 → DETRAN: UF reservada (fonte nacional indisponível).'),
  ('placa', 'ERR5A00', 500, '500 → erro interno reservado.'),
  ('chassi', 'ERR00000000000500', 500, '500 → erro interno reservado.'),
  ('cpf', '00000000500', 500, '500 → erro interno reservado.'),
  ('cnpj', '00000000000500', 500, '500 → erro interno reservado.'),
  ('renavam', '00000000500', 500, '500 → erro interno reservado.');

