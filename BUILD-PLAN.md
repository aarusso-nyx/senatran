# BUILD-PLAN.md — SENATRAN mock

Phased implementation plan. Each phase ends at a DEVAI gate and emits an evidence
record. Reference signal is `docs/framework/contracts/openapi.yaml`.

## Status

- **Current phase:** P1 (contract compilation) — starting.
- **P0 (bootstrap): complete.** git + pnpm + deps; directory tree; config
  (tsconfig, eslint, prettier, vitest, nest-cli, .env); NestJS skeleton boots and
  `/health` reports `db: up`; full DEVAI tier3 adopter bootstrap green
  (`devai doctor --adopter` 6/6); governance docs authored. Evidence: `EV-997185…`.

## Locked decisions

pnpm 9 + Node 24 · header-simulation auth · data-driven + magic-key scenarios ·
full DEVAI tier3 bootstrap · standalone plain `pg` · thin controllers over
`contract.*` views. See `DESIGN-DECISIONS.md`.

## Surface (from the official PDF)

57 GET endpoints under `/v1`: `veiculos` (20), `condutores` (12), `infracoes`
(10), `indicadores` (8), `ConsultaCSV` (2), `restricoesJudiciaisAtivas` (2),
`rouboFurto` (2), `autorizacoesAlteracaoVeiculo` (1). Every endpoint requires
`x-cpf-usuario`. Status codes 200/400/401/402/404/500; non-2xx =
`{ returnCode, message }`. List endpoints paginate via `idUltimoRegistro` +
`quantidade*`/`quantidade*Real`.

## Phases

| Phase            | Tasks | Output                                                                                 | Gate            |
| ---------------- | ----- | -------------------------------------------------------------------------------------- | --------------- |
| **P0 Bootstrap** | 1–5   | repo, deps, dirs, governance docs, `.devai/`, NestJS boots                             | doctor 6/6 ✔    |
| **P1 Contract**  | 6     | `openapi.yaml` (all endpoints), `auth.md`, `scenarios.md`                              | `openapi:check` |
| **P2 Design**    | 7–9   | data model + `contract.*` view catalog + mock-data spec, consolidated                  | review          |
| **P3 Database**  | 10    | `database/ddl/*` (tables, refs, views/matviews), seed generator, `apply.sh` runs clean | `db:reset`      |
| **P4 Services**  | 11    | 8 thin modules + `CpfUsuarioGuard` + exception filter                                  | `pnpm check`    |
| **P5 Tests**     | 12    | unit + db + api + e2e green; coverage gate; scorecard                                  | Cycle C         |

**Review checkpoints:** pause for human review after **P1** (contract) and after
**P2** (consolidated design) before writing DDL and services.

## Design summary (finalized in P2 — see `docs/framework/arch/`)

- **Thin controllers → `contract.*` views.** Two layers: 15 base object views
  (matviews for veiculo/condutor/infracao) pre-shape each entity's `payload jsonb`;
  57 per-endpoint views derive the final body (envelope / object / boolean). The
  service runs one `select payload from contract.v_<endpoint> where <key>=$1`.
  Full catalog in `docs/framework/arch/contract-views.md`.
- **Auth:** global `CpfUsuarioGuard` requires `x-cpf-usuario`; optional cert-CN
  allowlist toggled by `AUTH_CERT_SIMULATION`. Global filter renders
  `{ returnCode, message }`.
- **Scenarios:** data-driven (present→200, absent→404) + seeded `mock.scenario_key`
  magic keys forcing 401/402/404/500, documented for siblings.
- **Data model** (`docs/framework/arch/data-model.md`): schema `senatran` — entities
  `veiculo` (owner + indicators denormalized as columns), `condutor` (+ `_ocorrencia`;
  courses as flat columns), `condutor_imagem`, `condutor_infracao_extrato`, `infracao`
  (+ `_ocorrencia`, `_pagamento`), `restricao_judicial` (+ `_processo`),
  `roubo_furto_ocorrencia`, `csv_seguranca`, `comunicacao_venda`, `endereco_possuidor`,
  `multa_interestadual`, `recall`, `alteracao_permitida` — plus `ref_*` tables (uf,
  municipio, marca_modelo, cor, especie, tipo_veiculo, carroceria, categoria,
  combustivel, orgao_autuador, …), `mock` (usuario_autorizado, scenario_key), and
  `contract` (views/matviews). No separate `proprietario`/`indicador_veiculo` table —
  both are columns on `veiculo`.
- **Seeds** (`docs/framework/arch/mock-data.md`): deterministic (seeded PRNG),
  BR-valid formats with check digits, cross-linked, with documented known fixtures +
  magic-key sentinels.
- **Invariants:** 6 reference-signal units in `docs/framework/arch/invariants/`
  (AUTH, HTTP, API, DATA, SCEN, SEC), traced in `trace.json`.

## Test pyramid (P5)

unit (services with `Database` stub) · integration/db (views return exact JSON,
magic keys resolve, matview refresh) · api (supertest per endpoint + auth 401) ·
e2e (full scenario matrix 200/401/402/404/500, pagination, envelope). Coverage per
`.devai/config/thresholds.json`.
