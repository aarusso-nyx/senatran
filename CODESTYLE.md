# CODESTYLE.md

Style rules for `senatran`. Enforced by `eslint.config.js` + `.prettierrc` where
mechanical; the rest is convention. Run `pnpm fix` before committing.

## TypeScript

- **Strict, ESM, TS 6.** `strict: true`; no implicit `any`; no `@typescript-eslint/
no-explicit-any` violations in `src` (relaxed in tests).
- **ESM specifiers end in `.js`** even when importing a `.ts` source.
- **Explicit DI tokens.** Inject with `@Inject(Token)`; provide with
  `inject: [...]` factory arrays. Never rely on emitted decorator metadata (D-0007).
- **Single quotes, trailing commas** (Prettier). 2-space indent, LF, UTF-8.
- **Naming.** `lowercase-hyphenated` filenames (`veiculos.controller.ts`).
  `PascalCase` types/classes, `camelCase` values. DTO fields mirror the
  **Portuguese** contract names exactly.
- **No unused vars** except `^_`-prefixed.
- Prefer `type` imports (`import type { ... }`) for types-only usage.

## NestJS module shape

Each feature module (`domain/<group>/api/src/`) is a thin trio:

```text
<group>.module.ts       # @Module({ controllers, providers })
<group>.controller.ts   # @Controller('v1/...'), one method per endpoint
<group>.service.ts      # one SELECT against a contract.* view
<group>.controller.spec.ts / <group>.service.spec.ts
dto/                    # query/param DTOs with class-validator
```

Controllers contain no logic beyond param extraction + a single service call.
Services contain no logic beyond building the SQL params and returning rows.

## SQL / database

- **SQL-first.** Schema lives in `database/ddl/NN-*.sql`, ordered by the two-digit
  prefix. No ORM, no migrations tool — DDL is canonical, applied by `apply.sh`.
- **snake_case** identifiers in SQL; camelCase surfaced only in `contract.*` views
  via aliases / `jsonb_build_object` keys.
- Parameterized queries only (`$1, $2`); never string-concatenate input.
- One `contract.*` view (or matview) per endpoint; name `v_<intent>`
  (e.g. `v_veiculo_por_placa`). Views own JSON shaping.
- `COMMENT ON` every table/view; comments live in a dedicated `9N-*-comments.sql`.

## Errors & contract fidelity

- Every non-2xx response is `{ returnCode: number, message: string }`, produced by
  the global exception filter. Do not hand-roll error bodies in controllers.
- Field types follow the doc: código → number (`0` when absent), descrição →
  string (`"INDISPONÍVEL"` when absent), boolean → `false`/`true`, texto → `""`.

## Tests

- Co-locate unit specs next to sources (`*.spec.ts`). Integration/e2e under
  `tests/`. Name by tier suffix (`*.integration.spec.ts`, `*.e2e.spec.ts`).
- Unit tests stub `Database`; never hit a real DB in the unit tier.

## Language

Code identifiers that are part of the contract stay Portuguese. Comments and
governance docs are English. `docs/user/` may be Portuguese.
