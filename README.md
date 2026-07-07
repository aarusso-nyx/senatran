# senatran

**Dev-only mock services provider for the SERPRO WSDenatran public API.**

`senatran` reproduces the SENATRAN / DENATRAN public REST API surface
(vehicles, drivers, infractions, indicators) with deterministic synthetic data, so
that sibling repositories — **`pec`** and **`teat`** — have a valid, offline,
reproducible integration target during development and testing.

> ⚠️ This is **not** a production service. It must never be connected to real
> DENATRAN/SENATRAN systems or serve real personal data. Everything it returns is
> synthetic.

## What it mocks

**87 endpoints under `/v1`, one convention** — every endpoint requires the
`x-cpf-usuario` header and returns non-2xx as `{ returnCode, message }`
(Portuguese camelCase fields throughout):

- **Read — WSDenatran** (57 `GET`) from the official _WS Denatran — API-Doc v1_:
  `veiculos`, `condutores`, `infracoes`, `indicadores`, `restricoesJudiciaisAtivas`,
  `rouboFurto`, `ConsultaCSV`, `autorizacoesAlteracaoVeiculo`. →
  [`openapi.yaml`](docs/framework/contracts/openapi.yaml).
- **Transactional — RENACH/RENAINF** (30): driver-licensing exam and infraction
  lifecycle workflows — stateful (state machines, idempotency, audit), ported into
  WSDenatran conventions from the canonical reference. See
  [`openapi-transactional.yaml`](docs/framework/contracts/openapi-transactional.yaml)
  and [`canonical-mapping.md`](docs/framework/contracts/canonical-mapping.md).

## Stack

TypeScript 6 (strict, ESM) · NestJS 11 · PostgreSQL (SQL-first) · plain `pg` ·
Vitest (tiered) · pnpm 9 · Node 24. Governed by the **DEVAI** framework
(see [`GOVERNANCE.md`](GOVERNANCE.md)).

## Quick start

```bash
pnpm install                         # install dependencies
cp .env.example .env                 # local Postgres.app defaults work as-is
createdb senatran                    # or: psql -c 'create database senatran'
pnpm db:reset                        # apply DDL + sample data  (P3+)
pnpm start:dev                       # http://localhost:3000
curl localhost:3000/health           # {"status":"ok","db":"up"}
```

### With Docker (no local Node/Postgres needed)

One command brings up Postgres, applies the schema + deterministic seed, and
starts the API — the drop-in integration target for `pec` / `teat` and for CI:

```bash
docker compose up --build            # db + migrate + app, waits until healthy
curl localhost:3000/health           # {"status":"ok","db":"up"}
curl -H 'x-cpf-usuario: 12345678909' -H 'x-client-cert-cn: senatran-dev-client' \
     localhost:3000/v1/veiculos/placa/ABC1D23        # a seeded fixture
```

The stack is stateless: the seed is deterministic, so every `up` rebuilds the
same data. Known-good fixtures and magic keys are published in
[`database/seed/manifest.json`](database/seed/manifest.json). The
[`compose-smoke`](.github/workflows/compose-smoke.yml) workflow builds this
same stack and smoke-tests it on every push.

## Design in one paragraph

Controllers are **thin**: they parse path/query params and call a service that
issues a **single `SELECT` against a prepared `contract.*` view/materialized view**
which already shapes the row as the endpoint's exact JSON. Response scenarios are
**data-driven** (present → 200, absent → 404) with reserved **magic keys** that
force deterministic 401/402/404/500 for consumer tests. Authentication is a
**header simulation** of the real mTLS + `x-cpf-usuario` model. See
[`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md).

## Repository layout

See [`CONTEXT.md`](CONTEXT.md) for the full map. In short: `apps/api/src` (bootstrap

- health), `domain/<group>/api/src` (feature modules), `domain/shared/api/src`
  (config, database), `database/` (DDL, seeds, runners), `docs/` (contract +
  governance), `tests/` (unit/integration/e2e), `tools/scripts/` (generators).

## Documentation

- [`CONTEXT.md`](CONTEXT.md) — architecture, layout, commands.
- [`BUILD-PLAN.md`](BUILD-PLAN.md) — phased implementation plan and status.
- [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md) — decision log.
- [`GOVERNANCE.md`](GOVERNANCE.md) · [`CONTRIBUTING.md`](CONTRIBUTING.md) ·
  [`CODESTYLE.md`](CODESTYLE.md) · [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md).
