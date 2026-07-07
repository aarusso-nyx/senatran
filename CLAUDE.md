# CLAUDE.md — Session guide for the SENATRAN mock

This file governs agentic sessions in this repository for tools that read
`CLAUDE.md`. `AGENTS.md` is a terser parallel of this file; the two must be kept
in sync (DEVAI Constitution, Article 23 tie-breaker ladder).

## What this project is

`senatran` is a **dev-only mock services provider** for the SERPRO **WSDenatran**
public REST API (vehicles, drivers, infractions, indicators). It exists so sibling
repositories — **`pec`** and **`teat`** — have a valid, deterministic integration
target during development and testing. It is **not** a production service and must
never be pointed at real DENATRAN/SENATRAN data.

The contract mirrored here is the official _WS Denatran - API-Doc v1_ plus SERPRO
public documentation. The compiled, authoritative surface lives in
`docs/framework/contracts/openapi.yaml`.

## Read these first, in this order

1. `README.md` — one-page orientation.
2. `CONTEXT.md` — architecture, layout, commands, runtime surfaces.
3. `BUILD-PLAN.md` — the phased implementation plan and current status.
4. `docs/framework/contracts/openapi.yaml` — the API contract (source of truth).
5. `DESIGN-DECISIONS.md` — why the design is what it is.
6. `GOVERNANCE.md` — the evidence-based governance model.
7. `CONSTITUTION.md` → pointer to the sibling DEVAI Constitution (immutable axioms).

## Authority and roles (DEVAI five-role model)

Owner, Architect, Inspector, Engineer, Auditor. The human declares one role at
session start; it constrains which paths may be actuated (Constitution Article 6):

- **Owner** → `docs/framework/product/`, `docs/framework/glossary/` (joint).
- **Architect** → `docs/` (excl. product/), `README.md`, contracts, invariants, ADRs.
- **Engineer** → `apps/`, `domain/`, `database/`, `tools/`, root build config.
- **Inspector** → `**/*.spec.ts`, `tests/`, sensor/test config.
- **Auditor** → read-only over everything.

If the human has not declared a role, ask.

## Operating discipline

- **Propose before producing.** Describe intended work, get approval, execute the
  approved plan.
- **The contract is the reference signal.** Code and DB serve the WSDenatran
  contract in `openapi.yaml`; when they diverge, the contract wins unless the
  human amends it.
- **Thin controllers.** Controllers parse params and delegate; services issue a
  single query against a prepared `contract.*` view/matview. No business logic in
  TypeScript — the shaping lives in SQL.
- **Faithful errors.** Every non-2xx response is `{ returnCode, message }` with the
  WSDenatran status semantics (400/401/402/404/500).
- **Deterministic mock data.** Seeds are reproducible; magic-key fixtures for error
  scenarios are documented so siblings can rely on them.
- **Validate before declaring done.** Run `pnpm check` and the tier tests.

## Stack, locked

TypeScript 6 strict + ESM · NestJS 11 · Postgres (SQL-first, `database/ddl/*.sql`) ·
plain `pg` (no ORM, no `@stynx/*`) · Vitest (tiered) · pnpm 9 · Node 24. See
`DESIGN-DECISIONS.md`.

## Non-obvious conventions (read before writing code)

- **DI uses explicit `@Inject(Token)`.** `tsx`/esbuild does not emit decorator
  type metadata, so type-based Nest injection silently resolves to `undefined` in
  dev. Always annotate injected constructor params with `@Inject(...)`. See
  `DESIGN-DECISIONS.md` D-0007.
- **ESM import specifiers end in `.js`** even for `.ts` sources (NodeNext/Bundler).
- **API field names stay Portuguese** (contract-faithful). Governance docs are in
  English (DEVAI language policy); `docs/user/` may be Portuguese.

## What not to do

- Do not point this service at real SENATRAN endpoints or real personal data.
- Do not add business logic to controllers/services beyond a single view read.
- Do not modify `.devai/constitution.md` or `docs/framework/schemas/` outside an
  Architect-led change.
- Do not add dependencies without proposing them first.
- Do not run DB-mutating operations without confirming the target database.
