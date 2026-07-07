# BUILD-PLAN.md — SENATRAN mock

Phased implementation plan. Each phase ends at a DEVAI gate and emits an evidence
record. Reference signals: `docs/framework/contracts/openapi.yaml` (read) +
`openapi-transactional.yaml` (transactional).

## Status

- **P0 (bootstrap): complete.** git + pnpm + deps; dir tree; config; NestJS
  skeleton boots (`/health` db up); DEVAI tier3 adopter green (doctor 6/6). `EV-997185…`.
- **P1 (WSDenatran contract): complete.** `openapi.yaml` — 57 read endpoints,
  validated; `auth.md`, `scenarios.md`, `verify-openapi.ts`.
- **P2 (design): complete.** data-model, contract-view catalog, mock-data spec,
  9 invariants, consolidation.
- **Transposition: complete.** Canonical RENACH/RENAINF ported into WSDenatran
  conventions (unified 87-endpoint surface).
- **P3 (database): complete.** DDL (schemas, tables, 57+6 views), deterministic
  seed generator (field-for-field contract fidelity), `db:reset` clean. `EV-91ecf8…`.
- **P4 (services): complete.** 88 routes; global guard + filter + read seam; 8 thin
  read modules; RENACH/RENAINF transactional modules (state machine, idempotency,
  audit). `EV-ace00b…`.
- **P5 (tests): complete.** 122 tests — unit 63 (88% line coverage, gate ≥70%),
  integration 8, e2e 51. CI workflow added. All phases done.

## Locked decisions

pnpm 9 + Node 24 · header-simulation auth (all endpoints) · data-driven + magic-key
scenarios · full DEVAI tier3 bootstrap · standalone plain `pg` · thin controllers
over `contract.*` views for reads · transactional RENACH/RENAINF unified under
WSDenatran conventions (D-0009). See `DESIGN-DECISIONS.md`.

## Surface — 87 endpoints under `/v1`, one convention

**Read (WSDenatran, 57 GET).** `veiculos` (20), `condutores` (12), `infracoes`
(10), `indicadores` (8), `ConsultaCSV` (2), `restricoesJudiciaisAtivas` (2),
`rouboFurto` (2), `autorizacoesAlteracaoVeiculo` (1). Cursor pagination
(`idUltimoRegistro`). → `openapi.yaml`.

**Transactional (RENACH/RENAINF, 30).** RENACH (13: processos, elegibilidade,
agendamentos, exames médicos/psicológicos, junta, clínicas/profissionais) + RENAINF
(17: talonário, AITs, processos administrativos, autuação, defesa, penalidade,
recurso JARI/2ª instância, débito, pagamento). Stateful (state machines + rules
R001–R012), idempotent, audited. → `openapi-transactional.yaml`,
`canonical-mapping.md`, `renach-renainf-workflows.md`.

**Common (both):** base `/v1`; `x-cpf-usuario` + cert sim; `{ returnCode, message }`
on 400/401/402/404/500 (business rules → 402); Portuguese camelCase fields.

## Phases

| Phase            | Tasks | Output                                                                                                                            | Gate            |
| ---------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **P0 Bootstrap** | 1–5   | repo, deps, dirs, governance docs, `.devai/`, NestJS boots                                                                        | doctor 6/6 ✔    |
| **P1 Contract**  | 6     | `openapi.yaml` (57 read) + `openapi-transactional.yaml` (30) + auth/scenarios/errors                                              | `openapi:check` |
| **P2 Design**    | 7–9   | data model (read + transactional schemas) + view catalog + mock-data + workflows, consolidated                                    | review          |
| **P3 Database**  | 10    | `database/ddl/*` (read tables/views/matviews **+** renach/renainf/audit tables) + seed generator, applies                         | `db:reset`      |
| **P4 Services**  | 11    | 8 read modules (thin, over views) **+** renach/renainf transactional modules (state machine, idempotency, audit) + guard + filter | `pnpm check`    |
| **P5 Tests**     | 12    | unit + db + api + e2e (incl. RENACH/RENAINF workflows) green; coverage; scorecard                                                 | Cycle C         |

**Review checkpoints:** P1 and P2 reviewed. Transposition folds the transactional
surface into P3–P5 (both surfaces implemented together).

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
- **Invariants:** 9 reference-signal units in `docs/framework/arch/invariants/`
  (AUTH, HTTP, API, DATA, SCEN, SEC + RENACH, RENAINF, IDEMP for the transactional
  surface), traced in `trace.json`.

## Test pyramid (P5)

unit (services with `Database` stub) · integration/db (views return exact JSON,
magic keys resolve, matview refresh) · api (supertest per endpoint + auth 401) ·
e2e (full scenario matrix 200/401/402/404/500, pagination, envelope). Coverage per
`.devai/config/thresholds.json`.
