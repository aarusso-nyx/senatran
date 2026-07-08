# National-extension workflows — SENATRAN mock

This document is the behavioral contract for the **national-base extensions**
beyond the read (WSDenatran) and RENACH/RENAINF transactional surfaces. These are
national SENATRAN/SERPRO-facing systems modeled deterministically so `pec` and
`teat` can integrate against them. Why they belong in `senatran` (and what stays
out — municipal/tow/yard/provider systems) is argued in
[`../contracts/national-extensions-mapping.md`](../contracts/national-extensions-mapping.md).

Surfaces:

1. **RENAEST** — national crash/sinister base.
2. **SNE** — national electronic notification system.
3. **CDT** — citizen-channel projection over national data.
4. **State DETRAN national-base bridge** — a state actor feeding/consuming the
   national bases.

All share the existing conventions: `/v1` base path, `x-cpf-usuario` (plus
`x-client-cert-cn` when certificate simulation is on), the `{ returnCode, message }`
envelope, Portuguese camelCase fields, idempotent+audited writes (INV-IDEMP-001),
and deterministic seed fixtures published in `database/seed/manifest.json`.

## RENAEST crash/sinister base

RENAEST (Registro Nacional de Acidentes e Estatísticas de Trânsito) ingests
crash/sinister records transmitted by state DETRANs and other agencies. The mock
models the ingestion + protocol + correction lifecycle. Governed by
**INV-RENAEST-001**.

### State machine

```
            submit
   (POST /sinistros)
          │
          ▼
      RECEBIDO ──analysis──► EM_ANALISE ──consolidation──► CONSOLIDADO   (terminal)
          │                       │
          └───────────rejection───┴──────────────────────► REJEITADO    (terminal)
```

- A submission is accepted at **RECEBIDO** with a minted `idSinistro` and a
  `protocolo`. Seeded records also exist pre-positioned at `EM_ANALISE`,
  `CONSOLIDADO` and `REJEITADO`.
- **Complements** and **corrections** attach to a non-terminal record and are
  recorded for asynchronous analysis (`202`, `RETIFICACAO_EM_ANALISE`); they do
  not themselves advance the record's `situacao`.
- Terminal records (`CONSOLIDADO`, `REJEITADO`) reject complements/corrections.

### Endpoints

| Method + path                                          | Operation           | Success |
| ------------------------------------------------------ | ------------------- | ------- |
| `POST /v1/renaest/sinistros`                           | submit one crash    | 201     |
| `POST /v1/renaest/sinistros/lotes`                     | submit a batch      | 201     |
| `GET  /v1/renaest/sinistros/{idSinistro}`              | consult by crash id | 200     |
| `GET  /v1/renaest/protocolos/{protocolo}`              | consult by protocol | 200     |
| `POST /v1/renaest/sinistros/{idSinistro}/complementos` | submit complement   | 202     |
| `POST /v1/renaest/sinistros/{idSinistro}/correcoes`    | submit correction   | 202     |

### Business rules (RENAEST.E001–E005)

| Rule | Trigger                                                               | Result                                     |
| ---- | --------------------------------------------------------------------- | ------------------------------------------ |
| E001 | `versaoLeiaute` present and ≠ `1.0`                                   | 400 `RENAEST.CRASH.INVALID_LAYOUT`         |
| E002 | `local` missing                                                       | 402 `RENAEST.CRASH.INCOMPLETE_DATA`        |
| E003 | gravidade `COM_VITIMA_FERIDA`/`COM_VITIMA_FATAL` with empty `vitimas` | 402 `RENAEST.CRASH.INCOMPLETE_DATA`        |
| E004 | same natural tuple resubmitted without `Idempotency-Key`              | 402 `RENAEST.CRASH.DUPLICATED`             |
| E005 | complement/correction on a terminal record                            | 402 `RENAEST.CRASH.CORRECTION_NOT_ALLOWED` |
| —    | unknown `idSinistro`/`protocolo`                                      | 404 `RENAEST.CRASH.NOT_FOUND`              |
| —    | `codigoMunicipio` = `9999999` (magic key)                             | 500 (source-failure simulation)            |

The **natural key** for dedup (E004) is `(uf, codigoMunicipio, dataHoraSinistro,
orgaoResponsavel)`. Like RENAINF's duplicate rules, dedup fires only when no
`Idempotency-Key` is supplied; with the header, a replay returns the original
result (INV-IDEMP-001).

### Cross-cutting behavior

- **Idempotency** — writes route through `TransactionSupport.idempotent`. With an
  `Idempotency-Key`, a replay returns the stored `{status, body}`. Without it,
  E004 fires on a duplicate tuple.
- **Audit** — every submission/complement/correction writes one `audit.evento`
  row (`dominio = RENAEST`) with a SHA-256 payload hash, in the same transaction.
- **Cross-links** — a crash may reference an existing vehicle (`renavam`), driver
  (`cpfCondutor`) or infraction (`numeroAit`) under `referencias`; the mock
  validates shape only and never resolves them against real bases.

### Fixtures

Seeded, deterministic (see `renaest` in `database/seed/manifest.json`):
`SN00000000001` (accepted, RECEBIDO), `SN00000000002` (linked to vehicle
`renavam 00123456780`), `SN00000000003` (linked to condutor `52998224725`),
`SN00000000004` (linked to AIT `A0001001`), `SN00000000005` (terminal
`REJEITADO`), `SN00000000006` (`EM_ANALISE`), `SN00000000007` (carries a
pre-existing correction).

## SNE electronic notifications

SNE (Sistema de Notificação Eletrônica) delivers autuação/penalidade notices to
adherent vehicles/citizens through electronic channels. Governed by **INV-SNE-001**.

### State machine

```
   submit (POST /notificacoes/autuacao|penalidade)
          │  (agency + recipient must adhere; within the legal deadline)
          ▼
   canal disponível ─► ACEITA ──cancelamento──► CANCELADA   (terminal)
   canal INDISPONIVEL ─► PENDENTE
                         REJEITADA / EXPIRADA               (terminal, seeded)
```

### Endpoints

| Method + path                                        | Operation               | Success |
| ---------------------------------------------------- | ----------------------- | ------- |
| `GET  /v1/sne/adesoes/veiculos/{placa}`              | check vehicle adherence | 200     |
| `GET  /v1/sne/adesoes/cidadaos/{cpf}`                | check citizen adherence | 200     |
| `GET  /v1/sne/orgaos/{codigoOrgaoAutuador}/adesao`   | check agency adherence  | 200     |
| `POST /v1/sne/notificacoes/autuacao`                 | notify autuação         | 201     |
| `POST /v1/sne/notificacoes/penalidade`               | notify penalidade       | 201     |
| `GET  /v1/sne/notificacoes/{protocolo}`              | consult notification    | 200     |
| `POST /v1/sne/notificacoes/{protocolo}/cancelamento` | cancel notification     | 200     |

### Business rules (SNE.S001–S005)

| Rule | Trigger                                                                 | Result                                |
| ---- | ----------------------------------------------------------------------- | ------------------------------------- |
| S001 | agency not adherent                                                     | 402 `SNE.AGENCY.NOT_ADHERED`          |
| S002 | recipient (vehicle/citizen) not adherent                                | 402 `SNE.NOT_ADHERED`                 |
| S003 | `dataNotificacao` > `dataInfracao + 30d`                                | 402 `SNE.NOTICE.DEADLINE_EXPIRED`     |
| S004 | duplicate (numeroAit, tipo) without key, or cancel of a terminal notice | 402 `SNE.NOTIFICATION.INVALID_STATUS` |
| S005 | unknown `protocolo`                                                     | 404 `SNE.NOTIFICATION.NOT_FOUND`      |
| —    | `codigoOrgaoAutuador` = `999999` (magic key)                            | 500                                   |

Delivery `situacao` is `ACEITA` unless the channel is `INDISPONIVEL` (→ `PENDENTE`).
Notices link to RENAINF via `numeroAit`/`idProcesso`. Writes are idempotent
(`Idempotency-Key`) and audited (`dominio = SNE`).

## CDT citizen-channel projection

CDT (Carteira Digital de Trânsito) is a **read projection** over national data —
not an identity provider. Governed by **INV-CDT-001**.

### Endpoints

| Method + path                                       | Operation                   | Success |
| --------------------------------------------------- | --------------------------- | ------- |
| `GET  /v1/cdt/cidadaos/{cpf}/notificacoes`          | citizen-visible SNE notices | 200     |
| `GET  /v1/cdt/cidadaos/{cpf}/infracoes`             | citizen-visible infractions | 200     |
| `GET  /v1/cdt/cidadaos/{cpf}/veiculos`              | owned vehicles              | 200     |
| `GET  /v1/cdt/cidadaos/{cpf}/cnh`                   | CNH summary                 | 200     |
| `GET  /v1/cdt/infracoes/{numeroAit}/pagamento`      | payment/discount projection | 200     |
| `POST /v1/cdt/infracoes/{numeroAit}/reconhecimento` | recognize (unlock discount) | 200     |

### Discount model + business rules (CDT.C001–C004)

Discount tiers projected per infraction: **40%** (recognition path, SNE-adherent),
**20%** (standard early payment), **none**, or **boleto unavailable/pending**.

| Rule | Trigger                                              | Result                            |
| ---- | ---------------------------------------------------- | --------------------------------- |
| C001 | cpf not a condutor / owner / débito-holder           | 404 `CDT.CITIZEN.NOT_FOUND`       |
| C002 | unknown `numeroAit`                                  | 404 `CDT.INFRACTION.NOT_FOUND`    |
| C003 | reconhecimento with no discount / boleto unavailable | 402 `CDT.DISCOUNT.NOT_AVAILABLE`  |
| C004 | reconhecimento on a terminal/recognized infraction   | 402 `CDT.RECOGNITION.NOT_ALLOWED` |
| —    | `numeroAit` = `A0000500` (magic key)                 | 500                               |

Projections reflect SNE (`protocoloSne`) and RENAINF (`protocoloRenainf`) state.
The only write (`reconhecimento`) is audited (`dominio = CDT`).

## State-DETRAN national-base bridge

Models a state DETRAN acting **against the national bases** (RENAVAM/RENACH/
RENAINF/RENAEST/SNE) — never UF-proprietary APIs. Governed by **INV-DETRAN-001**;
the in/out boundary is `../contracts/national-extensions-mapping.md`.

### Endpoints

| Method + path                                             | Bridges to | Success |
| --------------------------------------------------------- | ---------- | ------- |
| `POST /v1/detrans/{uf}/renavam/consultasVeiculo`          | RENAVAM    | 201     |
| `POST /v1/detrans/{uf}/renach/consultasCondutor`          | RENACH     | 201     |
| `POST /v1/detrans/{uf}/renainf/autosInfracao`             | RENAINF    | 201     |
| `GET  /v1/detrans/{uf}/renainf/autosInfracao/{numeroAit}` | RENAINF    | 200     |
| `POST /v1/detrans/{uf}/renaest/sinistros`                 | RENAEST    | 201     |
| `POST /v1/detrans/{uf}/sne/notificacoes`                  | SNE        | 201     |

### Business rules (DETRAN.D001–D004)

| Rule | Trigger                           | Result                         |
| ---- | --------------------------------- | ------------------------------ |
| D001 | UF has no integration profile     | 404 `DETRAN.PROFILE.NOT_FOUND` |
| D002 | profile inactive/suspended        | 402 `DETRAN.PROFILE.INACTIVE`  |
| D003 | `versaoLeiaute` ≠ profile version | 400 `DETRAN.LAYOUT.INVALID`    |
| D004 | profile in `HOMOLOGACAO_PENDENTE` | 402 `DETRAN.BRIDGE.REJECTED`   |
| —    | `uf` = `ZZ` (magic key)           | 500                            |

A successful bridge mints a `protocoloDetran` linked to a `protocoloNacional`
(`situacao = ACEITO`), recorded in `detran.bridge` and audited (`dominio =
DETRAN`). The mock records the linkage; it does not re-drive the national state
machine (dev-only). Writes are idempotent (`Idempotency-Key`).

### Fixtures (SNE / CDT / DETRAN)

Deterministic, enumerated under `sne` / `cdt` / `detran` in
`database/seed/manifest.json`: SNE adherent vehicle `ABC1D23` / citizen
`52998224725` / agency `204020` (+ non-adherent `IND1I01` / `11144477735` /
`999998`) and notices `SNE-SEED-{AUT,PEN,REJ,EXP}-*`; CDT infractions
`A0001001` (40%), `A0001002` (20%), `A0001003` (none), `A0001004` (boleto
unavailable), `A0001005` (terminal); DETRAN profiles `SP` (active), `RJ`
(inactive), `BA` (rejects), and bridge `DTR-SP-SEED000001`.
