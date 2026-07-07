-- SENATRAN mock — transactional read-back views (RENACH/RENAINF GET endpoints).
-- These inject the live `situacao` into the stored payload so a read always
-- reflects the current state-machine position. Write endpoints are served by
-- domain services (D-0009), which may also read these views.

-- GET /v1/renach/processos/{numeroRenach}
create or replace view contract.v_renach_processo as
  select numero_renach,
         jsonb_set(payload, '{situacao}', to_jsonb(situacao)) as payload
  from renach.processo;

-- GET /v1/renach/processos/{numeroRenach}/exames
create or replace view contract.v_renach_exames as
  select numero_renach,
         jsonb_build_object(
           'quantidade', count(*),
           'exames', coalesce(jsonb_agg(payload order by data_realizacao), '[]'::jsonb)
         ) as payload
  from renach.exame
  group by numero_renach;

-- GET /v1/renach/clinicasCredenciadas
create or replace view contract.v_renach_clinicas as
  select coalesce(jsonb_agg(payload order by codigo_clinica), '[]'::jsonb) as payload
  from renach.clinica
  where credenciada and ativa;

-- GET /v1/renach/profissionaisCredenciados
create or replace view contract.v_renach_profissionais as
  select coalesce(jsonb_agg(payload order by cpf), '[]'::jsonb) as payload
  from renach.profissional
  where credenciado and ativo;

-- GET /v1/renainf/autosInfracao/{numeroAit}
create or replace view contract.v_renainf_ait as
  select numero_ait,
         jsonb_set(payload, '{situacao}', to_jsonb(situacao)) as payload
  from renainf.ait;

-- GET /v1/renainf/processosAdministrativos/{idProcesso}/debito
create or replace view contract.v_renainf_debito as
  select p.id::text as id_processo,
         jsonb_set(coalesce(d.payload, '{}'::jsonb), '{situacaoPagamento}', to_jsonb(d.situacao_pagamento)) as payload
  from renainf.processo p
  join renainf.debito d on d.processo_id = p.id;
