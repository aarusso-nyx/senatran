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
|                        | codigoMunicipio (body) | `9999999` (RENAEST — força 500 no submit)       |
|                        | codigoOrgaoAutuador    | `999999` (SNE/DETRAN — força 500)               |
|                        | numeroAit (path)       | `A0000500` (CDT — força 500)                    |
|                        | uf (path)              | `ZZ` (DETRAN — força 500)                       |
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
| sinistro (RENAEST)  | `SN00000000001`     | aceito, `situacao = RECEBIDO`                  |
| sinistro rejeitado  | `SN00000000005`     | terminal `REJEITADO` (correção não permitida)  |

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

### RENAEST (national extension)

RENAEST follows the same transactional pattern. Its scenarios are driven by state
and the natural dedup key:

- **Happy path** — `POST /v1/renaest/sinistros` with a complete body → `201`
  `{ idSinistro, protocolo, situacao: RECEBIDO }`. `GET` it back by `idSinistro`
  or `protocolo`.
- **Idempotent replay** — repeating the submit with the same `Idempotency-Key`
  returns the original `idSinistro`; without the header, a same-tuple resubmit
  (uf, codigoMunicipio, dataHoraSinistro, orgaoResponsavel) → `402`
  `RENAEST.CRASH.DUPLICATED`.
- **Validation / completeness** — `versaoLeiaute` ≠ `1.0` → `400`
  `RENAEST.CRASH.INVALID_LAYOUT`; a `COM_VITIMA_*` gravidade with no `vitimas`
  (or a missing `local`) → `402` `RENAEST.CRASH.INCOMPLETE_DATA`.
- **Terminal record** — complement/correction on `SN00000000005` (`REJEITADO`) →
  `402` `RENAEST.CRASH.CORRECTION_NOT_ALLOWED`.
- **Forced 500** — submit with `codigoMunicipio: 9999999` → `500`.

The seeded crashes cross-link existing fixtures (vehicle `renavam 00123456780`,
condutor `52998224725`, AIT `A0001001`); all are enumerated under `renaest` in
[`database/seed/manifest.json`](../../../database/seed/manifest.json).

### SNE / CDT / DETRAN (national extensions)

Same state-and-fixture pattern. Highlights (full detail + every key under `sne` /
`cdt` / `detran` in `manifest.json`, and the rule tables in `errors.md` /
`../arch/national-extensions-workflows.md`):

- **SNE** — check adherence (`GET /v1/sne/adesoes/…`), then `POST
/v1/sne/notificacoes/autuacao` with an adherent agency + recipient → `201`
  `ACEITA`. Non-adherent agency → `SNE.AGENCY.NOT_ADHERED`; non-adherent
  recipient → `SNE.NOT_ADHERED`; late `dataNotificacao` →
  `SNE.NOTICE.DEADLINE_EXPIRED`; duplicate/terminal cancel →
  `SNE.NOTIFICATION.INVALID_STATUS`. Adherent fixtures: veículo `ABC1D23`,
  cidadão `52998224725`, órgão `204020`.
- **CDT** — citizen views under `/v1/cdt/cidadaos/{cpf}/…` (`52998224725`);
  unknown CPF → `CDT.CITIZEN.NOT_FOUND`. Discount projection per infraction:
  `A0001001` (40%), `A0001002` (20%), `A0001003` (none), `A0001004` (boleto
  unavailable), `A0001005` (recognition not allowed).
- **DETRAN bridge** — `POST /v1/detrans/{uf}/…`; UF `SP` active, `RJ` inactive
  (`DETRAN.PROFILE.INACTIVE`), `BA` rejects (`DETRAN.BRIDGE.REJECTED`), unknown UF
  → `DETRAN.PROFILE.NOT_FOUND`, mismatched `versaoLeiaute` →
  `DETRAN.LAYOUT.INVALID`.
