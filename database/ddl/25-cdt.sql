-- SENATRAN mock — CDT projection tables (Carteira Digital de Trânsito).
-- CDT is NOT an identity provider: it is a deterministic citizen-channel
-- projection over national data (SNE notifications, RENAINF infractions,
-- vehicles, CNH). Ported as a national extension (national-extensions-mapping.md,
-- D-0011). Only the payment/discount projection needs its own table; the other
-- views read existing national fixtures (senatran.veiculo / condutor,
-- sne.notificacao).

create table cdt.infracao (
  numero_ait          text primary key,
  cpf                 text not null,
  situacao            text not null default 'DISPONIVEL',  -- DISPONIVEL | RECONHECIDA | PAGA | INDISPONIVEL
  valor_original      numeric(10, 2) not null,
  percentual_desconto int not null default 0,             -- 0 | 20 | 40
  valor_com_desconto  numeric(10, 2),
  boleto_disponivel   boolean not null default true,
  linha_digitavel     text,
  data_vencimento     date,
  origem              text,                               -- RENAINF | SNE
  protocolo_sne       text,
  protocolo_renainf   text,
  reconhecida         boolean not null default false,
  payload             jsonb not null default '{}'::jsonb
);
create index idx_cdt_infracao_cpf on cdt.infracao (cpf);
