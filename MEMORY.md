# MEMORY.md

Durable, cross-session lessons and non-obvious facts for `senatran`. Keep entries
short; link to the authoritative doc. Newest at the top.

- **DI needs `@Inject(Token)`.** `tsx`/esbuild emits no decorator type metadata, so
  type-based Nest injection silently yields `undefined` (no boot error). Always use
  explicit `@Inject(...)`. → `DESIGN-DECISIONS.md` D-0007.

- **`devai evidence-emit` crashes with `--human`.** Omit `--human`; it prints the
  `{id, manifest_hash}` JSON on success. Required flags: `--actor`, `--actor-role`
  (owner|architect|engineer|inspector|auditor|harness), `--status`.

- **`devai doctor --adopter` tier3 requires a docs-site shape.** Needs
  `docs/site/{docusaurus.config.ts,sidebars.ts,package.json}` (non-placeholder
  `url`/`organizationName`, curated sidebar with `label:`), `docs/start/index.md`
  landing, `docs/framework/constitution.md` stub, and `CONSTITUTION.md` listed in
  both agents-docs reading order and `docs/_ia/categories.json` root allowlist.

- **Local Postgres is Postgres.app 18** on `localhost:5432`, trust auth. Both
  `postgres` and `aarusso` roles connect with no password. Dev DB: `senatran`.

- **Contract source** is `~/Downloads/WS Denatran - API-Doc v1.pdf` (117 pages);
  extracted text was mined for the OpenAPI. ~59 GET endpoints, all requiring
  `x-cpf-usuario`; non-2xx = `{returnCode, message}`.

- **Siblings' expectation** (from `pec` ADR-0003 + known-gaps): certificate-based
  auth simulation, driver lookup by CPF / CPF+registro / registroCnh, info tiers,
  and a documented error-scenario matrix. `senatran` fills that dev-only gap.
