# Response scenarios — SENATRAN mock

The mock produces responses two ways, so consumers (`pec`, `teat`) get both
realistic happy paths and deterministic error paths (`DESIGN-DECISIONS.md` D-0005).

## 1. Data-driven (the default)

The response follows the state of the seeded database:

- The requested identifier **exists** → `200` with the contract payload.
- The requested identifier is **well-formed but absent** → `404` not found.
- A **malformed** required parameter → `400` bad request (validation).

Most integration flows should use ordinary seeded identifiers (see the known
fixtures below) and rely on this behavior.

## 2. Magic keys (forced scenarios)

Reserved sentinel identifiers force a specific status, independent of the data.
They are held in the seeded table `mock.scenario_key(kind, key_value,
force_status, message)` and consulted **before** the data-driven lookup. Consumers
may hardcode these values in tests; they are a stable part of the contract.

### Reserved sentinels

| Intent                 | Where                  | Reserved value                                  |
| ---------------------- | ---------------------- | ----------------------------------------------- |
| **401** Unauthorized   | `x-cpf-usuario` header | `00000000000`                                   |
| **402** Business error | placa                  | `ERR2A02`                                       |
|                        | chassi                 | `ERR00000000000402`                             |
|                        | cpf (path)             | `00000000402`                                   |
|                        | cnpj (path)            | `00000000000402`                                |
|                        | renavam (path)         | `00000000402`                                   |
| **500** Server error   | placa                  | `ERR5A00`                                       |
|                        | chassi                 | `ERR00000000000500`                             |
|                        | cpf (path)             | `00000000500`                                   |
|                        | cnpj (path)            | `00000000000500`                                |
|                        | renavam (path)         | `00000000500`                                   |
| **404** Not found      | any                    | _(no sentinel — use any absent well-formed id)_ |

All sentinels are format-valid (placas follow the Mercosul `LLLNLNN` shape; CPF 11
digits; CNPJ 14; chassi 17) yet clearly synthetic. The deterministic seed
generator never emits the `ERR…` prefix or these numeric patterns, so sentinels
never collide with real mock data.

### Resolution order (guard → filter → service)

1. `x-cpf-usuario` missing/malformed → **401**.
2. Certificate simulation enabled and CN not allowlisted → **401** (see `auth.md`).
3. `x-cpf-usuario == 00000000000` → **401** (forced).
4. Primary path identifier matches a `mock.scenario_key` row → **forced status**
   (402/500/…), body `{ returnCode, message }`.
5. Otherwise data-driven: `200` if the contract view returns a row, else `404`.

## Known good fixtures

The seed guarantees a small set of **stable** identifiers with full, documented
payloads that consumers may hardcode. These are emitted first by the generator and
never change across reseeds:

| Kind                | Value                              | Notes                                |
| ------------------- | ---------------------------------- | ------------------------------------ |
| placa (Mercosul)    | `ABC1D23`                          | vehicle with owner, indicators clear |
| placa (legacy)      | `ABC1234`                          | legacy-format plate                  |
| chassi              | _(published in the seed manifest)_ | linked to `ABC1D23`                  |
| cpf (condutor)      | _(published in the seed manifest)_ | driver with CNH + one infraction     |
| cnpj (proprietário) | _(published in the seed manifest)_ | company owner                        |

> The authoritative fixture list is emitted by `pnpm seed:generate` into
> `database/seed/README.md` (P3). This document defines the **mechanism and
> sentinels**; the seed manifest enumerates the exact generated fixtures.
