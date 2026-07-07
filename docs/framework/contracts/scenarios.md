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

| Kind                | Value               | Notes                                          |
| ------------------- | ------------------- | ---------------------------------------------- |
| placa (Mercosul)    | `ABC1D23`           | vehicle with owner, indicators clear           |
| placa (legacy)      | `ABC1234`           | legacy-format plate, CNPJ owner                |
| placa (indicadores) | `IND1I01`           | alarme + roubo/furto + transferência + penhora |
| chassi              | `9BWZZZ377VT004251` | linked to `ABC1D23`                            |
| renavam             | `00123456780`       | linked to `ABC1D23`                            |
| cpf (condutor)      | `52998224725`       | driver with CNH; also owner of `ABC1D23`       |
| cnpj (proprietário) | `11444777000161`    | company owner of `ABC1234`                     |
| renach (processo)   | `RS123456789`       | at `AGUARDANDO_MEDICO`                         |
| clínica credenciada | `RS-CLINIC-0001`    | credenciada + ativa                            |
| AIT (RENAINF)       | `A0001001`          | AIT-record `situacao = AUTUACAO_ABERTA`        |

> The **authoritative, machine-readable** fixture list — including the
> credentialed examiner CPF, exact counts, and every magic key — is emitted by
> `pnpm seed:generate` into [`database/seed/manifest.json`](../../../database/seed/manifest.json).
> Siblings should read that file rather than hardcoding from this table. This
> document defines the **mechanism and sentinels**; the manifest enumerates the
> exact generated fixtures.

## 3. Transactional scenarios (RENACH / RENAINF)

The transactional endpoints are stateful, so their scenarios are driven by the
**state of the process/case** rather than magic keys. See
`../arch/renach-renainf-workflows.md` and `errors.md`.

- **Happy path** — a call valid for the current `situacao` advances the state
  machine and returns 200/201/202 with the updated resource (and `protocolo`).
- **Business-rule / state violation** — a call invalid for the current state or
  breaking a rule (R001–R012) returns **402** with the domain code in `message`
  (e.g. imposing a penalty before defense handling → `RENAINF.PENALTY.ALREADY_IMPOSED`
  / `RENAINF.CASE.INVALID_STATUS`; second-instance before JARI →
  `RENAINF.APPEAL.PREVIOUS_INSTANCE_REQUIRED`; unaccredited examiner →
  `RENACH.EXAMINER.NOT_ACCREDITED`).
- **Not found** — unknown `numeroRenach` / `numeroAit` / `idProcesso` → **404**
  (`RENACH.PROCESS.NOT_FOUND`, `RENAINF.CASE.NOT_FOUND`).
- **Validation** — malformed AIT number/infraction code or missing required payload
  field → **400** (`RENAINF.AIT.INVALID_NUMBER`, `RENAINF.AIT.INVALID_INFRACTION_CODE`).
- **Idempotent replay** — repeating a write with the same `Idempotency-Key`
  header returns the original result, not a duplicate. Without the header, a
  repeated create/action instead triggers its business rule (e.g.
  `RENAINF.AIT.DUPLICATED`, `RENAINF.PENALTY.ALREADY_IMPOSED`) → 402 (INV-IDEMP-001).

Seed fixtures include processes/cases pre-positioned at representative states (e.g.
a RENACH process at `AGUARDANDO_MEDICO`, a RENAINF case at `NOTIFICADO_AUTUACAO`) so
consumers can drive each transition deterministically; the exact fixtures (process
number, credentialed clinic/examiner, AIT number and states) are enumerated in
[`database/seed/manifest.json`](../../../database/seed/manifest.json).
