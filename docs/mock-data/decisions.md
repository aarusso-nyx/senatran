# Decisões técnicas

Somente decisões que afetam diretamente o resultado do Data Seeder.

## Estrutura de Veículo

- O data model é a referência desejada para a divergência identificada em
  Veículo: `chassi` é a chave primária; `placa` e `codigo_renavam` são únicos e
  obrigatórios.
- `id bigserial` permanece único e gerado pelo banco, exclusivamente como cursor
  técnico de `idUltimoRegistro`. O seeder não fornece esse valor nos inserts.
- As demais escolhas físicas atuais permanecem: colunas de busca mais
  `payload jsonb`, códigos textuais e ausência das FKs não existentes no DDL.
  Em conflito sobre o formato da resposta, prevalece o OpenAPI.

## Conteúdo gerado

- O payload deve conter as propriedades aplicáveis dos componentes OpenAPI de
  Condutor e Veículo e manter suas âncoras iguais às colunas relacionais.
- CPF, registro CNH e RENACH são únicos na massa padrão. Identificadores opcionais
  também não se repetem quando presentes, sem transformar isso em nova constraint
  de domínio.
- CPF, CNPJ, placa, chassi e RENAVAM usam os geradores regulados existentes.
- Dados humanos podem usar `@faker-js/faker` com locale `pt_BR`, versão fixada e
  streams independentes por entidade; identificadores regulados não usam Faker.
- Dados auxiliares são derivados de um único Condutor ou Veículo, preservando
  chaves e valores equivalentes.
- As distribuições já decididas são 70/30 para placas Mercosul/legadas e
  80/10/5/5 para situações de CNH. Para os demais campos sem fonte, use casos
  mínimos determinísticos em vez de percentuais inventados.
- A geração usa `2025-01-01T00:00:00Z` como data-base fixa; não depende do relógio
  do sistema.

## Escopo e segurança

- O trabalho se divide entre entidades principais e as sete auxiliares diretamente
  usadas pelos endpoints de Condutores e Veículos.
- O volume de referência para validação é 10.000 Condutores e 10.000 Veículos; os
  pequenos seeds SQL versionados continuam independentes.
- Catálogos existentes são preenchidos de forma idempotente: inserir ausente,
  preservar idêntico e falhar diante de descrição divergente.
- O seeder não deve mascarar filtros incorretos da aplicação com dados artificiais.
- Execução contra ambiente de produção é proibida e deve falhar antes de qualquer
  escrita.

## Agente — base da próxima implementação

Para viabilizar exclusivamente o fluxo CSV → COPY → validação, a próxima etapa
adotará uma estrutura mínima de agente com:

- `cpf`;
- `matricula`;
- `codigo_orgao_autuador`;
- `ativo`;
- chave composta `(cpf, matricula, codigo_orgao_autuador)`.

Estrutura proposta para a próxima implementação:

```sql
create table renainf.agente (
  cpf                     text not null,
  matricula               text not null,
  codigo_orgao_autuador   text not null,
  ativo                   boolean not null default true,
  primary key (cpf, matricula, codigo_orgao_autuador)
);
```

Essa é uma proposta de implementação derivada da investigação, e não uma tabela
já existente nem a modelagem definitiva de agente no produto. A estrutura não
terá `id bigserial` ou `payload` sem necessidade demonstrada. A massa será
integralmente sintética.

A próxima implementação não incluirá a consulta dessa estrutura pelo serviço, a
regra R003 nem a emissão de `RENAINF.AIT.INVALID_AGENT`.

## Dispositivo — base da próxima implementação

- Usar `renainf.dispositivo` exatamente como está no DDL, sem redesenho.
- O CSV terá as seis colunas existentes: `id_dispositivo`,
  `codigo_orgao_autuador`, `homologado`, `ativo`, `sne_aderido` e `payload`.
- Os IDs gerados serão diferentes dos seeds `DEV-0001` a `DEV-0015`. O namespace
  `DEV-CSV-000001`, `DEV-CSV-000002`, ... é a convenção proposta para o gerador,
  não uma regra de domínio.
- Preservar os seeds existentes e não alterar `tools/scripts/generate-seed.ts`;
  os CSVs não serão uma segunda fonte autoritativa para os mesmos IDs.
- Não promover `descricao` ou `lavradoOffline` a colunas.

## Plantão — decisão pendente

Plantão não receberá DDL, schema, CSV, relações ou regras até que o responsável
responda à única pergunta bloqueante:

> O que “plantão” representa para a aplicação consumidora e quais campos ela
> espera receber ou consultar?
