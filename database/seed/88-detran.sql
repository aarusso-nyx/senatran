-- SENATRAN mock seed — DETRAN bridge (generated).
insert into detran.perfil (uf, codigo_orgao, perfil_integracao, versao_leiaute, ativo, payload) values
  ('SP', '204020', 'PRODUCAO', '1.0', true, '{"uf":"SP","codigoOrgao":"204020","perfilIntegracao":"PRODUCAO","versaoLeiaute":"1.0","ativo":true}'::jsonb),
  ('RJ', '204040', 'PRODUCAO', '1.0', false, '{"uf":"RJ","codigoOrgao":"204040","perfilIntegracao":"PRODUCAO","versaoLeiaute":"1.0","ativo":false}'::jsonb),
  ('BA', '292920', 'HOMOLOGACAO_PENDENTE', '1.0', true, '{"uf":"BA","codigoOrgao":"292920","perfilIntegracao":"HOMOLOGACAO_PENDENTE","versaoLeiaute":"1.0","ativo":true}'::jsonb);

insert into detran.bridge (protocolo_detran, uf, sistema_nacional, protocolo_nacional, numero_ait, situacao, payload) values
  ('DTR-SP-SEED000001', 'SP', 'RENAINF', 'RENAINF-SEED000001', 'A0001001', 'ACEITO', '{"protocoloDetran":"DTR-SP-SEED000001","uf":"SP","sistemaNacional":"RENAINF","protocoloNacional":"RENAINF-SEED000001","numeroAit":"A0001001","codigoOrgao":"204020","perfilIntegracao":"PRODUCAO","versaoLeiaute":"1.0","situacao":"ACEITO","retorno":{"numeroAit":"A0001001"}}'::jsonb);

