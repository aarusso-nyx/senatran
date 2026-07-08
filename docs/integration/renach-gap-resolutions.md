# RENACH integration — resolution of PEC-reported gaps

Sibling `pec` adopted the shared `senatran` mock for RENACH read/validation and
recorded two confirmed contract gaps (its `docs/meta/project/integrations/known-gaps.md`,
2026-07-07). Both are now resolved as below.

## Gap 1 — `openProcess`: **closed** (new endpoint)

`pec` needs to open a RENACH process per candidate and receive a `numeroRenach`.
The whole RENACH surface — here and in the canonical corpus it was ported from —
only ever _reads_ an existing process, so there was no entry point.

**Resolution:** added `POST /v1/renach/processos`.

- Request: `{ cpf, tipoProcesso, categoriaAtual?, categoriaPretendida? }`
  (schema `AberturaProcessoRenachRequest`).
- Response **201** `ProcessoRenach` with a freshly minted `numeroRenach`
  (`RN` + 11 digits, from a DB sequence) at situação `ABERTO`. The existing
  lifecycle (`elegibilidadeExame` → `agendamentos` → `examesMedicos` → …)
  continues unchanged from there.
- One active process per `(cpf, tipoProcesso)`: a duplicate open returns
  **402 `RENACH.PROCESS.ALREADY_OPEN`** (terminal `APROVADO`/`REJEITADO` do not
  block a new one). The `Idempotency-Key` header de-duplicates true retries
  (replay returns the same `numeroRenach`).
- `cpf` need not be an existing condutor — a `PRIMEIRA_HABILITACAO` candidate is
  not yet a driver.

This is a **WSDenatran extension** beyond the canonical corpus (flagged in
`canonical-mapping.md`); homologation against the official process-opening
path/vocabulary remains a private-contract task. `pec` can now retire its
bespoke `POST /mock/renach/processes` and map `openProcess` →
`POST /v1/renach/processos`, persisting the returned `numeroRenach` as its
`renachProcessKey`.

### Follow-up — recovering the key on `ALREADY_OPEN`

The 402 `ALREADY_OPEN` envelope carries no `numeroRenach`, and there was no way
to look up an existing process without already knowing its number. So a caller
hitting a genuine duplicate (an active process it never linked) could not report
`ALREADY_OPEN` with the key — only fail.

**Resolution:** added `GET /v1/renach/processos?cpf={cpf}&tipoProcesso={tipo}`.

- Lists the candidate's **active** processes (situação not in
  `APROVADO`/`REJEITADO`), optionally filtered by `tipoProcesso`, as
  `ProcessoRenachListResponse` (`{ processos: [ProcessoRenach] }`, possibly
  empty). The "which situação is active" rule stays owned by the mock, not the
  caller.
- `cpf` is required (`400` otherwise). Same `/v1` + `x-cpf-usuario` conventions.

`pec` now recovers the existing `numeroRenach` from this endpoint on a 402
`ALREADY_OPEN` and reports `status: 'ALREADY_OPEN'` with the key. Also a
WSDenatran extension (flagged in `canonical-mapping.md`).

## Gap 2 — `getDriverProfile(driverId)`: **not a provider gap** (consumer mapping)

`pec`'s `getDriverProfile(driverId)` keys off a **pec-internal** `driverId`.
SENATRAN has no such identifier — it knows a driver only by `cpf`,
`numeroRegistro` (registro CNH), `pgu`, or `pid`. Adding a `driverId`-keyed
endpoint would leak a consumer's internal identity into the provider contract,
which is incoherent, so **no endpoint is added**.

**Resolution (consumer side):** `pec` already persists the driver's `cpf` /
`registroCnh`; resolve `driverId → cpf` internally and call the existing read:

    GET /v1/condutores/cpf/{cpf}

which returns the full `Condutor` object (a superset of any "profile"). For the
richer variants use `GET /v1/condutores/cpf/{cpf}/registroCnh/{n}` etc. No
change on the mock; `pec`'s `known-gaps.md` entry can be closed as
"resolved — consumer-side identity mapping".
