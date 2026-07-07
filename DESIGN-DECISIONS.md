# DESIGN-DECISIONS.md

Decision log for `senatran`. Newest decisions may append; existing entries are
amended, not silently rewritten. Cross-references to the DEVAI Constitution use
article numbers.

---

## D-0001 — Standalone on plain `pg`, no `@stynx/*`

**Context.** The sibling `pec` depends on the `@stynx/*` shared libraries
(RLS-aware `Database.tx`, auth, tenancy, audit). `senatran` is a dev-only mock
with no multi-tenancy, RBAC, or audit obligations.

**Decision.** Stay standalone. Use plain `pg` behind a minimal `Database`
abstraction (`domain/shared/api/src/database/database.ts`) that mirrors the
`query`/`tx` shape so tests can stub it. No ORM.

**Consequences.** No workspace linkage to `../stynx`; the mock builds and runs on
its own. The `Database` abstract class is the single DB seam.

---

## D-0002 — Contract-first; OpenAPI is the reference signal

**Decision.** `docs/framework/contracts/openapi.yaml`, compiled from the official
_WS Denatran — API-Doc v1_, is the authoritative surface. Controllers, DTOs, views,
and tests conform to it. On drift, the contract wins unless an Architect amends it
(Constitution authority ladder).

---

## D-0003 — Thin controllers over prepared `contract.*` views

**Decision.** Controllers parse params and delegate. A service issues **one
`SELECT`** against a view/materialized view in the `contract` schema that already
shapes the row as the endpoint's exact JSON (`jsonb_build_object` / `json_agg`),
including the list envelope (`quantidade*`, `idUltimoRegistro`). No business logic
in TypeScript.

**Consequences.** Response shaping is testable in SQL (integration tier) and the
TS layer stays trivial. Heavy joins (proprietário+veículo+indicadores;
condutor+ocorrências+cursos) are materialized and refreshed by `apply.sh`.

---

## D-0004 — Header-simulated authentication

**Context.** The real WSDenatran requires an mTLS client certificate plus the
`x-cpf-usuario` header; 401 signals cert/CPF auth failure.

**Decision.** Simulate with headers. A global guard always requires
`x-cpf-usuario` (11-digit CPF → 401 if absent/malformed). When
`AUTH_CERT_SIMULATION=on`, an `x-client-cert-cn` header must match an allowlisted
CN (`mock.usuario_autorizado`, or the `AUTH_DEV_CERT_CNS` bootstrap list). The flag
can be turned `off` for frictionless dev.

**Consequences.** Consumers exercise realistic auth failures without provisioning
certificates. Documented in `docs/framework/contracts/auth.md`.

---

## D-0005 — Scenario control: data-driven + magic keys

**Decision.** Present in DB → 200; absent → 404. A seeded `mock.scenario_key`
table maps reserved identifiers to forced outcomes (401/402/404/500) so siblings
get deterministic error paths. Sentinels are documented in
`docs/framework/contracts/scenarios.md`. The guard/filter consult `scenario_key`
before the DB read, making error paths first-class.

---

## D-0006 — Deterministic, BR-valid mock data

**Decision.** `tools/scripts/generate-seed.ts` emits reproducible seed SQL:
CPF/CNPJ with valid check digits, placas (Mercosul `ABC1D23` + legacy `ABC1234`),
17-char chassis, 11-digit RENAVAM, coherently cross-linked entities. A small set of
**stable known fixtures** (documented placas/CPFs) plus the magic-key sentinels are
guaranteed contract points siblings may hardcode.

---

## D-0007 — Dependency injection uses explicit `@Inject(Token)`

**Context.** In dev the app runs under `tsx` (esbuild), which does **not** emit
`emitDecoratorMetadata`. NestJS type-based constructor injection therefore resolves
to `undefined` with no startup error — observed as `this.db` being undefined at
request time.

**Decision.** Always annotate injected constructor params with `@Inject(Token)`
(e.g. `@Inject(Database) private readonly db: Database`). Providers use explicit
`inject: [...]` factory arrays. Never rely on emitted parameter-type metadata.

**Consequences.** DI works identically under `tsx` (dev) and `tsc` (build). This is
a hard convention for every controller/service. ESM import specifiers end in `.js`
even for `.ts` sources (NodeNext/Bundler resolution).

---

## D-0008 — Full DEVAI tier3 adopter bootstrap

**Decision.** Adopt DEVAI at tier3 via the sibling CLI (`../devai`): `.devai/`
config + evidence chain, pinned constitution 0.3.0, governance docs, a minimal
docs-governance site shape, and `devai doctor --adopter` kept green (6/6). Evidence
is emitted at phase boundaries.

---

## D-0009 — Transactional RENACH/RENAINF unified under WSDenatran conventions

**Context.** A second reference corpus (`docs/reference/senatran-canonical-api/`)
documents 30 _transactional_ RENACH (driver-licensing exams) and RENAINF
(infractions lifecycle) endpoints, originally in an English, Bearer-JWT,
`Envelope`-wrapped style.

**Decision.** Port those endpoints into the **WSDenatran contract conventions**
rather than hosting a second API family. The unified surface (87 endpoints = 57
read + 30 transactional) all shares: base `/v1`; `x-cpf-usuario` + cert-simulation
auth (D-0004); the `{ returnCode, message }` error envelope (D-0002); and
**Portuguese camelCase field naming** reusing WSDenatran vocabulary. Canonical
domain error codes (`RENACH.*`/`RENAINF.*`) are carried in `message`; business-rule
violations map to **402**. The full port is `docs/framework/contracts/
canonical-mapping.md` + `openapi-transactional.yaml`.

**Consequences.** One convention everywhere; consumers use one auth + one error
model. The transactional endpoints are **not** thin-controllers-over-views (D-0003
applies to reads only): they are real domain services with a state machine,
idempotency, and audit (`renach-renainf-workflows.md`, INV-RENACH/RENAINF/IDEMP).
Bearer JWT, the `Envelope`, and JWT roles from the reference are **dropped** from
the external contract (retained only as internal notes). The reference corpus stays
under `docs/reference/` as provenance.
