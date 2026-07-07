# AGENTS.md — Instructions for agents (SENATRAN mock)

Terser parallel of `CLAUDE.md`. Same substance; keep both in sync (DEVAI
Constitution, Article 23). Either is authoritative.

## Project

`senatran` is a **dev-only mock** of the SERPRO **WSDenatran** public REST API
(vehicles/drivers/infractions/indicators), built as a deterministic integration
target for sibling repos `pec` and `teat`. Not production. Never real data.

Authoritative surface: `docs/framework/contracts/openapi.yaml`.

## Read first

`README.md` → `CONTEXT.md` → `BUILD-PLAN.md` →
`docs/framework/contracts/openapi.yaml` → `DESIGN-DECISIONS.md` →
`GOVERNANCE.md` → `CONSTITUTION.md`.

## Roles (DEVAI five-role model, Constitution Article 6)

Owner / Architect / Inspector / Engineer / Auditor. Human declares one at session
start; it constrains actuatable paths:

- Owner → `docs/framework/product/`, `docs/framework/glossary/` (joint).
- Architect → `docs/` (excl. product/), `README.md`, contracts, invariants, ADRs.
- Engineer → `apps/`, `domain/`, `database/`, `tools/`, root build config.
- Inspector → `**/*.spec.ts`, `tests/`, sensor/test config.
- Auditor → read-only.

If no role is declared, ask.

## Discipline

- Propose before producing; execute the approved plan.
- Contract (`openapi.yaml`) is the reference signal; it wins over code/DB on drift.
- Thin controllers: a service issues ONE query against a prepared `contract.*`
  view. No business logic in TypeScript.
- Every non-2xx body is `{ returnCode, message }` with WSDenatran status semantics.
- Deterministic seeds; documented magic-key fixtures for error scenarios.
- `pnpm check` + tier tests before declaring done.

## Stack (locked)

TS6 strict + ESM · NestJS 11 · Postgres SQL-first (`database/ddl/*.sql`) · plain
`pg` · Vitest tiered · pnpm 9 · Node 24.

## Gotchas

- DI: always `@Inject(Token)` — `tsx`/esbuild emits no decorator metadata
  (D-0007). ESM specifiers end in `.js`. API names Portuguese; governance docs
  English.

## Do not

- Point at real SENATRAN/personal data. Add logic to thin controllers. Edit
  `.devai/constitution.md` or `docs/framework/schemas/` outside Architect change.
  Add deps unproposed. Mutate a DB without confirming the target.
