# Design consolidation — P2 review

Task 9: review the P0–P2 artifacts for divergence and reconcile before any DDL is
written. This is the record of what was checked and resolved.

## Artifacts cross-checked

`openapi.yaml` · `data-model.md` · `contract-views.md` · `mock-data.md` ·
`auth.md` · `scenarios.md` · `DESIGN-DECISIONS.md` · `BUILD-PLAN.md` · `CONTEXT.md`
· `README.md` · the 6 invariants + `trace.json`.

## Divergences found and resolved

| #   | Divergence                                                                                                                      | Resolution                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Endpoint totals stated as "~59" and `veiculos (19)` in early prose.                                                             | Contract is exactly **57** operations; `veiculos` is **20**. README/BUILD-PLAN/CONTEXT corrected.                                                                                                                         |
| 2   | Early data model listed a separate `proprietario` table.                                                                        | Owner is **denormalized on `veiculo`** (`nome_proprietario`, `numero_identificacao_proprietario`, `codigo_tipo_proprietario`) because the `veiculos/proprietario/...` responses return vehicles. No `proprietario` table. |
| 3   | Early data model listed an `indicador_veiculo` table.                                                                           | Indicators are **columns on `veiculo`** (both placa and chassi lookups resolve to the same row). No indicator table.                                                                                                      |
| 4   | "One contract view per endpoint (~59)".                                                                                         | **Two layers**: 15 base object views (3 materialized) + 57 per-endpoint views. Documented in `contract-views.md`.                                                                                                         |
| 5   | Invariant domains (`HTTP`, `SCEN`) not in the DEVAI taxonomy; one anchor pointed at a YAML file; a trace `meta` field rejected. | Added `HTTP`/`SCEN` to `.devai/config/domains.json` client domains; repointed the anchor to markdown headings; removed the trace `meta`. `spec-validate-all` is green.                                                    |

## Confirmed consistent (no change needed)

- **Auth model** — `x-cpf-usuario` always required (401), `x-client-cert-cn`
  cert-simulation toggled by `AUTH_CERT_SIMULATION`. Consistent across `auth.md`,
  the `clientCertSimulation` security scheme in `openapi.yaml`, `INV-AUTH-001`, and
  `DESIGN-DECISIONS` D-0004.
- **Error envelope** — `{ returnCode, message }` on 400/401/402/404/500.
  Consistent across `openapi.yaml` (`ErrorResponse` + shared responses),
  `scenarios.md`, `INV-HTTP-001`.
- **Scenario resolution order** — auth → forced `scenario_key` → data-driven.
  Consistent across `scenarios.md` and `INV-SCEN-001`; contract views model only
  the happy path + natural 404.
- **Field-type fidelity** — `codigo*` text in `Veiculo`/`CodigoSegurancaCrv`,
  integer in `Infracao`; source typos preserved. `data-model.md` rule 3 matches the
  `openapi.yaml` schemas; `contract.*` views alias `senatran` snake_case columns to
  the exact (typo-preserving) JSON keys.
- **Pagination** — `idUltimoRegistro` cursor on the endpoints marked `⟳` in the
  catalog; base `id` exposed by the views for the service to page on.

## Open decisions carried into P3

- **DDL file ordering** follows the pec convention (`NN-*.sql`): `00` extensions,
  `01–0x` schemas + entity tables, `8x` ref-table seeds, `9x` contract views/
  matviews, comments. `apply.sh` applies DDL then (`--sample`) the generated seeds,
  then refreshes the three materialized base views.
- **Seed volumes** are targets (`mock-data.md`), tunable if a scenario needs more.
- **Trace test paths** are planned targets; the referenced spec files are authored
  in P5.

Consolidation complete — the design set is internally consistent and ready for P3.

---

## Addendum — canonical RENACH/RENAINF transposition

A second reference corpus (`docs/reference/senatran-canonical-api/`, 30
transactional endpoints) was folded in **after** P2. Decision D-0009: port it into
WSDenatran conventions rather than a second API family.

Artifacts added/updated: `contracts/openapi-transactional.yaml` (30 ops, validated),
`contracts/canonical-mapping.md` (path/field/error map — the source of truth),
`contracts/errors.md` (domain-code catalog), `arch/renach-renainf-workflows.md`
(state machines + rules), `arch/data-model.md` (+`renach`/`renainf`/`audit`
schemas), invariants `INV-RENACH-001`/`INV-RENAINF-001`/`INV-IDEMP-001` (+domains
RENACH/RENAINF/IDEMP, +trace), and updates to auth/scenarios/mock-data + the
governance docs (README, CLAUDE, AGENTS, CONTEXT, GOVERNANCE, BUILD-PLAN).

Divergences from the reference, reconciled to the unification directive:

| Reference                                | Ported                                               |
| ---------------------------------------- | ---------------------------------------------------- |
| base `/senatran-adapter/v1`              | `/v1`                                                |
| Bearer JWT + JWT roles + `X-Agency-Code` | `x-cpf-usuario` + cert sim (roles dropped)           |
| `Envelope {success,protocol,errors[]}`   | `{ returnCode, message }` (domain code in `message`) |
| English field names                      | Portuguese camelCase (WSDenatran vocabulary)         |
| required `Idempotency-Key`               | optional; natural-key dedupe                         |

Key architectural note: **D-0003 (thin controllers over views) applies to the read
surface only.** The transactional endpoints are real domain services (state
machine + idempotency + audit); their read-back responses are still shaped by
`contract.v_renach_*`/`contract.v_renainf_*` views. Verified: `openapi:check`
covers both contracts (87 ops) under identical rules; `spec-validate-all` green
(9 invariants + trace).
