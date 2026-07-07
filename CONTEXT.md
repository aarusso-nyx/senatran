# Project Context — SENATRAN mock

At-a-glance briefing for agents entering the repo cold. Stable architecture,
layout, and commands. Binding rules live in `AGENTS.md`/`CLAUDE.md`; governance in
`GOVERNANCE.md`; decisions in `DESIGN-DECISIONS.md`; the plan in `BUILD-PLAN.md`.

## System summary

`senatran` is a backend-only NestJS REST API that mocks the SERPRO **WSDenatran**
public contract for dev/test use by siblings `pec` and `teat`.

Core invariants:

- **Contract-first.** `docs/framework/contracts/openapi.yaml` is the reference
  signal; code and DB conform to it.
- **Thin controllers over prepared views.** A service issues one `SELECT` against a
  `contract.*` view/matview that emits the endpoint's exact JSON. No business logic
  in TypeScript.
- **Faithful error envelope.** Non-2xx = `{ returnCode, message }` with WSDenatran
  status semantics (400/401/402/404/500).
- **Header-simulated auth.** `x-cpf-usuario` always required (→401 if absent);
  optional cert-CN allowlist toggled by `AUTH_CERT_SIMULATION`.
- **Deterministic data.** Reproducible seeds; documented magic-key fixtures for
  error scenarios.
- Runtime: Node 24, pnpm 9, Postgres (local Postgres.app 18 in dev).

## Source-of-truth order

1. The contract (`openapi.yaml`). 2. Code. 3. Tests. 4. Current docs. Never weaken
   auth, the error envelope, or the contract shape to make stale docs/tests pass.

## Architecture

```text
HTTP clients (pec, teat)
      -> REST/JSON  /v1/...
apps/api/src/            NestFactory bootstrap, global ValidationPipe, health
      + global CpfUsuarioGuard (auth simulation) + WsdenatranExceptionFilter
domain/<group>/api/src/  8 feature modules: thin controller + service
domain/shared/api/src/   config (env), Database (pg Pool), guards, filters, mappers
      -> Database.query(sql, params)
database/                PostgreSQL DDL: senatran.* tables + reference data,
                         mock.* (usuario_autorizado, scenario_key),
                         contract.* base object views (matviews) + 57
                         per-endpoint views
```

## Layout

```text
apps/api/src/            main.ts, app.module.ts, health/, common/{guards,filters}
domain/
  shared/api/src/        config/, database/, common/
  veiculos/api/src/      + condutores, infracoes, indicadores,
                         restricoes-judiciais, roubo-furto, consulta-csv, autorizacoes
database/
  ddl/NN-*.sql           schemas, tables, reference data, functions, views/matviews
  seed/                  deterministic sample data + magic-key fixtures
  apply.sh  seed.sh      runners
docs/
  framework/contracts/   openapi.yaml (THE contract), auth.md, scenarios.md
  framework/arch/invariants/  INV-*.json (reference signal units)
  meta/gov/              governance evidence + scorecards
tests/{unit,integration,e2e,real,utils}
tools/scripts/           generate-seed.ts, verify-openapi.ts, lib/
.devai/                  DEVAI adopter state (config, evidence chain)
```

## Commands

| Task                     | Command                                      |
| ------------------------ | -------------------------------------------- |
| Install                  | `pnpm install`                               |
| Dev server               | `pnpm start:dev` (→ `http://localhost:3000`) |
| Build                    | `pnpm build`                                 |
| Lint / format            | `pnpm lint` · `pnpm format`                  |
| Typecheck                | `pnpm typecheck`                             |
| Apply DB (full + sample) | `pnpm db:reset`                              |
| Regenerate seed data     | `pnpm seed:generate`                         |
| Unit tests               | `pnpm test:unit`                             |
| Integration (DB) tests   | `pnpm test:integration`                      |
| E2E tests                | `pnpm test:e2e`                              |
| Contract check           | `pnpm openapi:check`                         |
| Aggregate gate           | `pnpm check`                                 |
| DEVAI doctor             | `pnpm devai:doctor`                          |
| DEVAI scorecard          | `pnpm devai:scorecard`                       |

## Test tiers

Selected by `SENATRAN_TEST_TIER` (default `unit`): `unit` (co-located `*.spec.ts`,
DB stubbed) · `integration` (`tests/integration/*.integration.spec.ts`, real PG,
contract views) · `e2e` (`tests/e2e/*.e2e.spec.ts`, full HTTP + PG, scenario
matrix) · `real` (reserved).

## Governance surface

DEVAI tier3 adopter. `pnpm devai:doctor` must stay green (6/6). Evidence chain in
`.devai/state/evidence-chain.json`; scorecards under `docs/meta/gov/compliance/`.
