# Data model — SENATRAN mock

Design of the PostgreSQL schema that backs the WSDenatran mock. This document
specifies **structure, keys, and rules**; the exhaustive per-field lists are the
component schemas in `../contracts/openapi.yaml` (the reference signal). The DDL in
`database/ddl/` (P3) is the canonical implementation of what is designed here.

Status: **design (P2)** — no DDL written yet.

## Schemas

| Schema     | Purpose                                                            |
| ---------- | ------------------------------------------------------------------ |
| `senatran` | Domain entities + reference (código↔descrição) tables.             |
| `mock`     | Mock-only control: authorized users, forced scenario keys.         |
| `contract` | Read views / materialized views that emit the exact response JSON. |

Rationale: the domain data is normalized in `senatran`; the mock's control plane
is isolated in `mock`; everything the HTTP layer reads is a prepared object in
`contract`. Services never touch `senatran.*` directly (see `contract-views.md`).

## Design rules

1. **snake_case** columns in `senatran`; the camelCase (and the source's
   intentional typos) surface only in `contract.*` view JSON keys.
2. **código↔descrição pairs** — the entity stores the `codigo_*` column; the
   matching `descricao_*` is resolved by joining a `senatran.ref_*` table in the
   contract view, `COALESCE`d to `'INDISPONÍVEL'` when absent (doc convention).
   This keeps one source of truth for descriptions and keeps seeds small.
3. **Field-type fidelity** follows the contract: código→`integer` **or**
   `text` exactly as the OpenAPI declares it per entity (e.g. `Veiculo.codigo*`
   are text, `Infracao.codigo*` are integer); data→`timestamptz`; booleano→
   `boolean`; texto→`text`.
4. **Every lookup key is an indexed column** on its entity (see per-table keys).
   Path params map 1:1 to a WHERE column.
5. **Indicators are columns**, not a table: alarme / roubo-furto / the four
   restrição-judicial flags / the three sinistro flags live on `veiculo`, since
   both `placa` and `chassi` lookups resolve to the same vehicle row.
6. **Owner is denormalized on `veiculo`** (`nome_proprietario`,
   `numero_identificacao_proprietario`, `codigo_tipo_proprietario`) because the
   `veiculos/proprietario/...` responses return vehicles, not an owner entity.

## Reference tables (`senatran.ref_*`)

Small curated sets seeded from real DENATRAN code tables. Source of truth for
descriptions; used by the seed generator and by contract-view joins.

| Table                     | Key           | Notes                                                                    |
| ------------------------- | ------------- | ------------------------------------------------------------------------ |
| `ref_uf`                  | `uf char(2)`  | 27 UFs.                                                                  |
| `ref_municipio`           | `codigo int`  | code, `uf`, `nome` (curated subset).                                     |
| `ref_marca_modelo`        | `codigo int`  | make/model.                                                              |
| `ref_cor`                 | `codigo int`  | vehicle colors.                                                          |
| `ref_especie`             | `codigo int`  | vehicle species.                                                         |
| `ref_tipo_veiculo`        | `codigo int`  | vehicle types.                                                           |
| `ref_carroceria`          | `codigo int`  | body types.                                                              |
| `ref_categoria`           | `codigo int`  | categories.                                                              |
| `ref_combustivel`         | `codigo int`  | fuels.                                                                   |
| `ref_tipo_proprietario`   | `codigo int`  | owner types.                                                             |
| `ref_orgao_autuador`      | `codigo int`  | code, `uf`, `nome`.                                                      |
| `ref_situacao_cnh`        | `codigo text` | CNH situations.                                                          |
| `ref_nacionalidade`       | `codigo int`  | nationalities.                                                           |
| `ref_sexo`                | `codigo int`  | 1/2/… → descrição.                                                       |
| `ref_tipo_documento`      | `codigo int`  | ID document types.                                                       |
| `ref_restricao`           | `codigo int`  | vehicle restriction codes.                                               |
| `ref_classificacao_curso` | `codigo text` | driver course classifications.                                           |
| `ref_modalidade_curso`    | `codigo text` | course modalities.                                                       |
| `ref_tipo_alteracao`      | `codigo text` | allowed vehicle alteration types (feeds `autorizacoesAlteracaoVeiculo`). |

## Entity tables (`senatran.*`)

> **Storage realization (D-0010).** Each read entity table is `<key columns…>,
payload jsonb` — `payload` is the exact contract object (generated from the
> OpenAPI schema); the key columns below are indexed lookups extracted from it.
> The per-table "full column list" is therefore the payload's fields (= the OpenAPI
> schema); only the key columns are physical scalar columns. Contract views select
> `payload` and wrap the envelope.

Below: primary/lookup keys and relationships only.

### `veiculo` ← schema `Veiculo` (+ indicator & CSV-derived flags)

- **PK** `chassi text`. **Unique**: `placa`, `codigo_renavam`.
- **Lookup columns** (all indexed): `placa`, `codigo_renavam`, `numero_motor`,
  `numero_cambio`, `numero_identificacao_proprietario` (+ `codigo_tipo_proprietario`
  to distinguish CPF vs CNPJ owner).
- Indicator columns: `ind_alarme`, `ind_roubo_furto`, `ind_transferencia`,
  `ind_licenciamento`, `ind_circulacao`, `ind_penhora`, `ind_sinistro_media_monta`,
  `ind_sinistro_grande_monta`, `ind_sinistro_recuperado`.
- código_* columns FK to the relevant `ref_*` tables.

### `condutor` ← schema `Condutor`

- **PK** `id bigserial`. **Lookup columns** (indexed): `cpf`, `numero_registro`
  (registroCnh), `numero_formulario_renach`, `numero_lista_impedimento`,
  `numero_pgu`, `numero_formulario_pid`, and the composite
  (`nome`, `data_nascimento`, `nome_mae`).
- Flat CNH-course fields (`classificacao_curso_*`, `uf_curso_*`, `data_curso_*`)
  are columns (they are flat in the response), with `codigo` FKs where a `ref_*`
  applies.
- **`condutor_ocorrencia`** ← schema `CondutorOcorrencia`: `id`, `condutor_id`
  (FK), impediment/block fields. One condutor → many ocorrências.

### `condutor_imagem` ← schema `CondutorImagem`

- Backs `condutores/{imagens,retrato,validacao}`. **Keys**: (`cpf`,
  `numero_registro`, `numero_seguranca`). Holds the validity/booleans and (for
  imagens/retrato) a base64 image field.

### `condutor_infracao_extrato` ← schema `CondutorInfracaoExtrato`

- Backs `condutores/infracoes/registroCnh/{n}`. **Key** `numero_registro_cnh`.
  Header fields + `condutor_infracao_item` children.

### `infracao` ← schema `Infracao`

- **PK** `id bigserial`. **Lookup columns** (indexed): composite (`auto_infracao`,
  `codigo_orgao_autuador`, `codigo_infracao`) for AIT; plus `cpf`, `cnpj`,
  `numero_registro_cnh`, `numero_pgu`+`uf`, `placa`+`situacao_exigibilidade`,
  `codigo_renainf`, `identificacao_habilitacao_estrangeira`.
- **`infracao_ocorrencia`** ← `InfracaoOcorrencia` (keyed by AIT triple).
- **`infracao_pagamento`** ← `InfracaoPagamento` (keyed by AIT triple).

### `restricao_judicial` ← schemas `RestricaoJudicialItem`/`Processo`

- **PK** `id`. **Keys**: `placa`, `renavam`. Children `restricao_judicial_processo`.

### `roubo_furto_ocorrencia` ← schema `RouboFurtoOcorrencia`

- **PK** `id`. **Keys**: `placa`, `chassi`.

### `csv_seguranca` ← schema `CodigoSegurancaCrv` / `ConsultaCsv`

- **PK** `id`. **Keys**: `codigo_seguranca_crv`+`renavam`+`placa`+owner
  (`cpf`|`cnpj`) for CRV validation; `chassi`, `placa` for ConsultaCSV.

### `comunicacao_venda` ← schema `ComunicacaoVenda`

- **Keys**: owner (`cpf`|`cnpj`) + `renavam` + `placa`.

### `endereco_possuidor` ← schema `EnderecoPossuidor`

- **Keys**: `placa` (+ optional `renavam`).

### `multa_interestadual` ← schema `MultaInterestadual`

- **Keys**: owner (`cpf`|`cnpj`) + `renavam` + `placa`.

### `recall` ← schema `Recall`

- **Key**: `chassi`.

### `alteracao_permitida` ← schema `AlteracaoPermitida`

- Static list from `ref_tipo_alteracao`. Backs `autorizacoesAlteracaoVeiculo`.

## `mock` schema

| Table                     | Columns                                                                                   | Purpose                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `mock.usuario_autorizado` | `cpf text pk`, `cert_cn text`, `nome text`, `ativo bool`                                  | Allowlist for the `x-cpf-usuario` + `x-client-cert-cn` auth simulation (`auth.md`).                                      |
| `mock.scenario_key`       | `kind text`, `key_value text`, `force_status int`, `message text`, PK(`kind`,`key_value`) | Reserved magic keys forcing 401/402/404/500 (`scenarios.md`). `kind` ∈ {placa, chassi, cpf, cnpj, renavam, cpf_usuario}. |

## Relationships (overview)

```text
veiculo 1─* infracao            (placa / codigo_renavam)
veiculo 1─* restricao_judicial  (placa / renavam)
veiculo 1─* roubo_furto_ocorrencia (placa / chassi)
veiculo 1─1 endereco_possuidor / comunicacao_venda / csv_seguranca / recall
condutor 1─* condutor_ocorrencia
condutor 1─* infracao           (numero_registro_cnh / cpf)
infracao 1─* infracao_ocorrencia / infracao_pagamento (AIT triple)
ref_*    1─* entity código columns
```

Referential coherence (a driver's infractions reference a real vehicle, etc.) is
enforced by the **seed generator** (`mock-data.md`), not by hard FKs across every
denormalized column — the mock optimizes for faithful payloads, not write
integrity.

---

## Transactional schemas — RENACH & RENAINF

The transactional endpoints (ported per `../contracts/canonical-mapping.md`) are
**stateful writes**, so — unlike the read-only WSDenatran side — they use real
tables with proper FKs, a `situacao` state column, and audit. Two schemas plus a
shared `audit` schema. Column names are snake_case; contract read-back views
(`contract.v_renach_*`, `contract.v_renainf_*`) alias them to the Portuguese
camelCase JSON of `openapi-transactional.yaml`.

### `renach` schema

| Table                    | Keys                                     | Notes                                                                                                                                                                                                  |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `renach_processo`        | PK `id uuid`; **unique** `numero_renach` | `cpf`, `tipo_processo`, `situacao`, `categoria_atual`, `categoria_pretendida`, `data_abertura`, `data_expiracao`. State machine per `renach-renainf-workflows.md`.                                     |
| `renach_clinica`         | PK `codigo_clinica`                      | `cnpj`, `nome`, `uf`, `credenciada bool`, `ativa bool`. Feeds `clinicasCredenciadas` + R003.                                                                                                           |
| `renach_profissional`    | PK `cpf`                                 | `conselho` (CRM/CRP), `numero_conselho`, `uf`, `codigo_clinica` (FK), `credenciado bool`, `ativo bool`. Feeds R004.                                                                                    |
| `renach_agendamento`     | PK `id uuid`                             | `numero_renach` (FK), `data_hora`, `codigo_clinica`, `situacao` (AGENDADO/CANCELADO/CHECKIN).                                                                                                          |
| `renach_exame`           | PK `id uuid`                             | `numero_renach` (FK), `tipo_exame` (MEDICO/PSICOLOGICO), `resultado`, `codigo_clinica`, `cpf_examinador`, `data_realizacao`, `data_validade`, `payload jsonb`. Restrições in `renach_exame_restricao`. |
| `renach_exame_restricao` | PK `id`                                  | `exame_id` (FK), `codigo`, `descricao`.                                                                                                                                                                |
| `renach_junta`           | PK `id uuid`                             | `numero_renach` (FK), `tipo` (ENCAMINHAMENTO/PARECER), `situacao`, `payload jsonb`.                                                                                                                    |

### `renainf` schema

| Table                        | Keys                                  | Notes                                                                                                                              |
| ---------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `renainf_dispositivo`        | PK `id_dispositivo`                   | `codigo_orgao_autuador`, `homologado bool`, `ativo bool`. R002.                                                                    |
| `renainf_faixa_ait`          | PK `id`                               | `codigo_orgao_autuador`, `numero_inicial`, `numero_final`, `reservada bool`. R... AIT.OUT_OF_RANGE.                                |
| `renainf_ait`                | PK `id uuid`; **unique** `numero_ait` | `codigo_orgao_autuador`, `situacao`, `placa`, `codigo_infracao`, `data_infracao`, `cpf_agente`, `id_dispositivo`, `payload jsonb`. |
| `renainf_processo`           | PK `id uuid` (idProcesso)             | `ait_id` (FK), `situacao` (RASCUNHO…ARQUIVADO), `payload jsonb`. Drives the RENAINF state machine.                                 |
| `renainf_indicacao_condutor` | PK `id`                               | `processo_id` (FK), `cpf_condutor`, `data`.                                                                                        |
| `renainf_defesa`             | PK `id`                               | `processo_id` (FK), `tipo_requerente`, `numero_documento`, `fundamentacao`, `data_protocolo`, `resultado`.                         |
| `renainf_penalidade`         | PK `id`                               | `processo_id` (FK), `valor`, `pontos`, `data_imposicao`.                                                                           |
| `renainf_recurso`            | PK `id uuid` (idRecurso)              | `processo_id` (FK), `instancia` (JARI/SEGUNDA_INSTANCIA), `id_recurso_anterior`, `situacao`, `resultado`. R010 ordering.           |
| `renainf_debito`             | PK `processo_id`                      | `valor`, `situacao_pagamento`, `data_vencimento`.                                                                                  |
| `renainf_pagamento`          | PK `id`                               | `processo_id` (FK), `valor_pago`, `data_pagamento`, `forma_pagamento`, `numero_comprovante`.                                       |

### `audit` schema (shared)

| Table                | Keys                   | Notes                                                                                                                                                                                                                               |
| -------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit.evento`       | PK `id uuid`           | `dominio` (RENACH/RENAINF), `entidade`, `entidade_id`, `tipo_evento`, `situacao_anterior`, `situacao_nova`, `payload jsonb`, `payload_hash` (sha256), `cpf_usuario`, `criado_em`. One row per state transition (R010 / RENAINF.R…). |
| `audit.idempotencia` | PK (`escopo`, `chave`) | `resultado jsonb`, `status_http int`, `criado_em`. Backs write idempotency (natural key or `Idempotency-Key`).                                                                                                                      |

### Notes

- Writes go through domain services (not contract views): validate business rules
  → 402, mutate state, write `audit.evento`, then return the resource shaped by a
  `contract.v_renach_*`/`contract.v_renainf_*` read-back view.
- `renainf_ait.codigo_infracao`/`placa` can reference the WSDenatran `infracao`/
  `veiculo` seed data so the two surfaces are coherent (an AIT lavrado here can be
  queried on the read side).
- Reference/enum descriptions (situações, resultados, tipos) live in
  `senatran.ref_*` where a codigo/descricao pair is warranted.
