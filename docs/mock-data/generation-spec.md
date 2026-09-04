# Especificação de geração

## DDL e colunas CSV

`senatran.veiculo` usa `chassi` como chave primária, `placa` e
`codigo_renavam` como valores obrigatórios e únicos, e mantém `id bigserial`
único como cursor técnico. `senatran.condutor` mantém `id bigserial` como chave
primária. `id` é gerado pelo banco e não aparece nos CSVs.

As propriedades camelCase do payload que correspondem às colunas relacionais
devem ter o mesmo valor. O schema de cada tabela declara essa correspondência em
`x-source` e a ordem do cabeçalho em `x-columnOrder`.

## Formatos específicos

| Campo                | Tipo/formato                                           | Único na massa      | Geração                                       |
| -------------------- | ------------------------------------------------------ | ------------------- | --------------------------------------------- |
| CPF                  | texto, 11 dígitos, verificadores mod-11                | sim                 | base aleatória determinística + verificadores |
| CNPJ de proprietário | texto, 14 dígitos, matriz `0001`, verificadores mod-11 | não                 | base determinística + `0001` + verificadores  |
| registro CNH         | texto, 11 dígitos                                      | sim                 | dígitos determinísticos                       |
| RENACH               | texto, `RN` + 10 dígitos                               | sim                 | prefixo + dígitos determinísticos             |
| impedimento/PGU/PID  | texto, `IMP`/`PGU`/`PID` + 7 dígitos                   | sim quando presente | prefixo + índice preenchido com zeros         |
| placa                | texto, `LLLNLNN` ou `LLLNNNN`, sem I/O/Q               | sim                 | gerador regulado; 70% Mercosul e 30% legada   |
| chassi               | texto, 17 caracteres VIN, sem I/O/Q                    | sim                 | gerador regulado                              |
| RENAVAM              | texto, 11 dígitos, verificador mod-11                  | sim                 | base determinística + verificador             |
| motor/câmbio         | texto, `MOT`/`CAM` + 7 dígitos                         | sim quando presente | prefixo + índice preenchido com zeros         |

Nomes e endereços usam `@faker-js/faker` 10.1.0 com locale `pt_BR` e seed
derivada por entidade. Identificadores regulados não usam Faker.

## Ranges e conjuntos

- nascimento: 1945-01-01 a 2006-12-28 (18 a 80 anos na data-base);
- primeira habilitação: entre 18 e 35 anos após o nascimento;
- emissão de CNH: de 2015 a 2024 e nunca antes da primeira habilitação;
- validade: 2024 para vencida ou 2026 a 2033 para as demais;
- situação CNH: `A`, `V`, `B`, `S`, `C`, com massa de referência 80/10/5/5;
- sexo: `1` ou `2`; booleanos de indicadores: `true` ou `false`;
- fabricação: 1990 a 2024; ano-modelo igual ao de fabricação ou um ano maior;
- potência: 25 a 300; cilindradas: 250 a 6000; eixos: 2 a 3;
- lotação: 3 a 42; PBT: 2000 a 16000; CMT: 3500 a 25000;
  CMC: 4000 a 30000;
- códigos de município, marca/modelo, cor, espécie, tipo, carroceria,
  categoria, combustível, proprietário e situação CNH vêm dos catálogos
  curados do projeto.

Os schemas JSON em `tools/data-seeder/schemas/` são a definição estruturada
consumida pelo gerador CSV. Extensões `x-*` registram origem, ordem, unicidade e
limites de data que não são palavras-chave nativas do JSON Schema.

## Agente — especificação para próxima implementação

A tabela abaixo é uma proposta ainda não implementada, adotada somente para
viabilizar CSV → COPY → validação:

```text
x-table: renainf.agente
x-entity: agente
```

Ordem das colunas:

```text
cpf
matricula
codigo_orgao_autuador
ativo
```

Cabeçalho CSV:

```text
cpf,matricula,codigo_orgao_autuador,ativo
```

Regras de geração e validação:

- gerar CPF sintético válido, com 11 dígitos e verificadores;
- gerar matrícula determinística e não vazia;
- obter `codigo_orgao_autuador` do catálogo `ORGAOS_AUTUADOR` já utilizado pelo
  projeto;
- emitir `ativo` como booleano explícito;
- não repetir a combinação CPF + matrícula + órgão;
- produzir conteúdo idêntico para os mesmos schema, quantidade e seed.

COPY esperado:

```sql
\copy renainf.agente (
  cpf,
  matricula,
  codigo_orgao_autuador,
  ativo
)
FROM '<arquivo>'
WITH (FORMAT csv, HEADER true);
```

Validação mínima:

```sql
select count(*) as total
from renainf.agente;
```

```sql
select
  count(*) filter (where ativo) as ativos,
  count(*) filter (where not ativo) as inativos
from renainf.agente;
```

```sql
select cpf, matricula, codigo_orgao_autuador, ativo
from renainf.agente
order by codigo_orgao_autuador, matricula
limit 20;
```

```sql
select a.codigo_orgao_autuador
from renainf.agente a
left join senatran.ref_orgao_autuador o
  on o.codigo = a.codigo_orgao_autuador
where o.codigo is null;
```

A última consulta deve retornar zero linhas. A unicidade da combinação deve ser
garantida pela chave composta proposta e pelo validador do CSV.

## Dispositivo — especificação para próxima implementação

```text
x-table: renainf.dispositivo
x-entity: dispositivo
```

Ordem das colunas:

```text
id_dispositivo
codigo_orgao_autuador
homologado
ativo
sne_aderido
payload
```

Cabeçalho CSV:

```text
id_dispositivo,codigo_orgao_autuador,homologado,ativo,sne_aderido,payload
```

Regras de geração e validação:

- gerar `id_dispositivo` determinístico e único;
- não usar os IDs seed `DEV-0001` a `DEV-0015`;
- usar namespace próprio para os CSVs, com `DEV-CSV-000001`,
  `DEV-CSV-000002`, ... como convenção proposta do gerador;
- obter `codigo_orgao_autuador` do catálogo curado do projeto;
- emitir `homologado`, `ativo` e `sne_aderido` como booleanos explícitos;
- emitir `payload` como JSON válido em célula CSV corretamente escapada;
- manter `payload.idDispositivo`, `payload.codigoOrgaoAutuador`,
  `payload.homologado`, `payload.ativo` e `payload.sneAderido` coerentes com as
  colunas correspondentes;
- produzir conteúdo idêntico para os mesmos schema, quantidade e seed.

COPY esperado:

```sql
\copy renainf.dispositivo (
  id_dispositivo,
  codigo_orgao_autuador,
  homologado,
  ativo,
  sne_aderido,
  payload
)
FROM '<arquivo>'
WITH (FORMAT csv, HEADER true);
```

Validação mínima:

```sql
select count(*) as total
from renainf.dispositivo;
```

```sql
select
  count(*) filter (where homologado and ativo) as utilizaveis,
  count(*) filter (where not homologado) as nao_homologados,
  count(*) filter (where not ativo) as inativos,
  count(*) filter (where not sne_aderido) as nao_aderentes_sne
from renainf.dispositivo;
```

```sql
select
  id_dispositivo,
  codigo_orgao_autuador,
  homologado,
  ativo,
  sne_aderido
from renainf.dispositivo
where id_dispositivo like 'DEV-CSV-%'
order by id_dispositivo
limit 20;
```

```sql
select id_dispositivo
from renainf.dispositivo
where payload->>'idDispositivo' is distinct from id_dispositivo
   or payload->>'codigoOrgaoAutuador' is distinct from codigo_orgao_autuador
   or (payload->>'homologado')::boolean is distinct from homologado
   or (payload->>'ativo')::boolean is distinct from ativo
   or (payload->>'sneAderido')::boolean is distinct from sne_aderido;
```

A última consulta deve retornar zero linhas.

## Plantão

**STATUS: BLOQUEADO.**

- Não existe tabela definida.
- Não existe schema definido.
- Não existe cabeçalho CSV definido.
- A implementação depende da decisão pendente registrada em `decisions.md`.

## Alterações técnicas esperadas

| Arquivo | Responsabilidade na próxima implementação |
| --- | --- |
| `database/ddl/21-renainf.sql` | Adicionar somente a estrutura mínima proposta de agente; adicionar plantão apenas após sua definição. |
| `tools/data-seeder/schemas/agente.schema.json` | Declarar tabela, entidade, ordem, obrigatoriedade, formato do CPF e tipos das quatro colunas. |
| `tools/data-seeder/schemas/dispositivo.schema.json` | Declarar as seis colunas reais, unicidade do ID, booleanos e coerência das âncoras do payload. |
| `tools/data-seeder/schemas/plantao.schema.json` | Criar somente após a definição pendente. |
| `tools/data-seeder/generators.ts` | Adicionar candidates e geradores determinísticos de agente e dispositivo; plantão somente após definição. |
| `tools/data-seeder/validation.ts` | Validar identificadores, órgãos, unicidade, booleanos e coerência do payload conforme cada entidade. |
| `tools/data-seeder/csv-generator.ts` | Ampliar unions, allowlist e dispatcher para selecionar o gerador e validador de cada entidade. |
| `tests/unit/data-seeder-csv.spec.ts` | Cobrir geração determinística e serialização das novas entidades implementadas. |

Não são necessárias alterações funcionais em:

- `package.json`, pois `pnpm data:generate` já aponta para a CLI correta;
- `tools/data-seeder/csv-cli.ts`, que já recebe schema, quantidade, saída e seed;
- `tools/data-seeder/cli.ts`, `orchestrator.ts`, `persistence.ts` ou
  `preflight.ts`, pertencentes ao fluxo de persistência direta;
- `tools/scripts/generate-seed.ts`, que permanece responsável pelos seeds SQL
  transacionais existentes.
