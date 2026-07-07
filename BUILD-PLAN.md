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

~59 GET endpoints under `/v1`: `veiculos` (19), `condutores` (13), `infracoes`
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

## Design summary (see DESIGN-DECISIONS.md)

- **Thin controllers → `contract.*` views.** One `SELECT` per endpoint against a
  view/matview emitting exact JSON via `jsonb_build_object`/`json_agg`.
- **Auth:** global `CpfUsuarioGuard` requires `x-cpf-usuario`; optional cert-CN
  allowlist toggled by `AUTH_CERT_SIMULATION`. Global filter renders
  `{ returnCode, message }`.
- **Scenarios:** data-driven (present→200, absent→404) + seeded `mock.scenario_key`
  magic keys forcing 401/402/404/500, documented for siblings.
- **Data model:** schema `senatran` (veiculo, proprietario, condutor + ocorrências/
  cursos, infracao + ocorrências/pagamentos, restricao_judicial, indicador_veiculo,
  alteracao_permitida, csv_seguranca, endereco_possuidor, comunicacao_venda,
  recall) + reference tables (uf, municipio, marca_modelo, cor, especie, categoria,
  combustivel, orgao_autuador, …) + `mock` (usuario_autorizado, scenario_key) +
  `contract` (views/matviews).
- **Seeds:** deterministic, BR-valid formats, cross-linked, with documented known
  fixtures + magic-key sentinels.

## Test pyramid (P5)

unit (services with `Database` stub) · integration/db (views return exact JSON,
magic keys resolve, matview refresh) · api (supertest per endpoint + auth 401) ·
e2e (full scenario matrix 200/401/402/404/500, pagination, envelope). Coverage per
`.devai/config/thresholds.json`.
