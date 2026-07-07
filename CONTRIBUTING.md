# CONTRIBUTING.md

Practical workflow for `senatran`. Read `AGENTS.md`/`CLAUDE.md` for the binding
rules and `CODESTYLE.md` for style.

## Prerequisites

- Node 24 (`.nvmrc`), pnpm 9 (`corepack enable` or install pnpm ≥9).
- A local PostgreSQL. Dev default targets Postgres.app 18 on
  `localhost:5432` with trust auth (`postgres://postgres@localhost:5432/senatran`).
- The sibling DEVAI checkout at `../devai` (built) for governance commands.

## Setup

```bash
pnpm install
cp .env.example .env
createdb senatran
pnpm db:reset          # apply DDL + sample data (once P3 lands)
pnpm start:dev
```

## Everyday commands

| Intent                 | Command                                          |
| ---------------------- | ------------------------------------------------ |
| Run dev server         | `pnpm start:dev`                                 |
| Format + autofix       | `pnpm fix`                                       |
| Lint / typecheck       | `pnpm lint` · `pnpm typecheck`                   |
| Unit tests             | `pnpm test:unit` (watch: `pnpm test:unit:watch`) |
| DB / integration tests | `pnpm test:integration`                          |
| E2E tests              | `pnpm test:e2e`                                  |
| Contract check         | `pnpm openapi:check`                             |
| Rebuild seed data      | `pnpm seed:generate` then `pnpm db:reset`        |
| Local gate             | `pnpm check`                                     |
| DEVAI health           | `pnpm devai:doctor`                              |

## Database changes

Schema is SQL-first under `database/ddl/NN-*.sql`, ordered by prefix. To change the
schema: edit/add the appropriate `NN-*.sql`, keep `contract.*` views in sync with
`openapi.yaml`, then `pnpm db:reset` to reapply. There is no migration tool — the
DDL set is canonical.

## Adding an endpoint

1. Confirm the shape in `docs/framework/contracts/openapi.yaml` (edit it first if
   the contract must change — it is the reference signal).
2. Add/adjust the `contract.*` view that returns the exact JSON.
3. Add a thin controller method + service `SELECT` in the feature module.
4. Add unit (stubbed DB), integration (view shape), and e2e (HTTP + scenarios)
   tests.
5. `pnpm check` green; update the trace if an invariant is touched.

## Definition of done

`pnpm check` passes, the new/changed behavior is covered at the right tiers,
`pnpm devai:doctor` stays 6/6, and an evidence record is emitted for the phase.

## Commits

Conventional, imperative subject lines. Do not commit `.env`, `dist/`, or volatile
`.devai/state/` artifacts (see `.gitignore`). Never commit real personal data.
