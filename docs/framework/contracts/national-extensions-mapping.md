# SENATRAN national extensions — provenance & boundary map

This document explains **why** the RENAEST, SNE, CDT and State-DETRAN-bridge
surfaces belong in `senatran`, what national-base semantics they model, and —
critically — what stays **out**. It is the boundary authority for the national
extensions the way [`canonical-mapping.md`](canonical-mapping.md) is for the
ported RENACH/RENAINF corpus (DEVAI Constitution Article 23 tie-breaker: the
contract + this map win over consumer assumptions).

Unlike RENACH/RENAINF, these surfaces have **no canonical reference corpus** under
`docs/reference/`. They are modeled from public national-base semantics and
marked as **proposed national extensions**: deterministic, dev-only, and additive.
Where real-world SENATRAN ownership of a specific endpoint is uncertain, the
endpoint is documented here as a proposed national extension and kept
deterministic — never pointed at a real system.

## What belongs in `senatran` (national-base semantics)

`senatran` mocks **national SENATRAN/SERPRO-facing bases** and the actors that
feed or consume them:

- **RENAVAM / RENACH / RENAINF** — already present (read + transactional).
- **RENAEST** — national crash/sinister base.
- **SNE** — national electronic notification system.
- **CDT** — a citizen-channel _projection_ over national data (SNE/RENAINF).
- **State DETRAN as an actor** — but **only** for interactions that feed or
  consume the national bases (RENAVAM/RENACH/RENAINF/RENAEST/SNE).

## What stays OUT (municipal / provider / UF-proprietary)

The following are **not** SENATRAN national-base concerns and must never be
implemented inside `senatran` — they live in the consuming repos or their own
mocks:

- municipal competence agreements and local municipal process bridges
- tow providers, yards, inventories
- vehicle release/receipt workflows
- UF-proprietary DETRAN endpoints unrelated to national-base semantics

If a consumer (e.g. `teat`) needs a municipal/tow/yard fake, it stays local to
that consumer; `senatran` deliberately does not absorb it.

## Convention unification (same as the rest of the mock)

| Aspect       | National extensions                                                                 |
| ------------ | ----------------------------------------------------------------------------------- |
| Base path    | `/v1` (single surface)                                                              |
| Auth         | `x-cpf-usuario` (+ cert simulation `x-client-cert-cn`), per `auth.md`               |
| Success body | raw JSON object                                                                     |
| Error body   | `{ returnCode, message }`; domain code carried in `message` as `CODE — descrição`   |
| Status codes | 200 (read), 201 (create), 202 (async); errors 400/401/402/404/500                   |
| Field names  | Portuguese camelCase                                                                |
| Idempotency  | optional `Idempotency-Key`; without it, a repeated write triggers its business rule |
| Contract     | `openapi-transactional.yaml` (extended, not a separate file)                        |

## Surface: RENAEST (crash/sinister national base)

Ported endpoints (no reference corpus — proposed national extension). Behavior and
state machine: [`../arch/national-extensions-workflows.md`](../arch/national-extensions-workflows.md).

| Ported path (`/v1`)                                 | Purpose                          | Success |
| --------------------------------------------------- | -------------------------------- | ------- |
| POST `/renaest/sinistros`                           | submit one crash                 | 201     |
| POST `/renaest/sinistros/lotes`                     | submit a batch of crashes        | 201     |
| GET `/renaest/sinistros/{idSinistro}`               | consult crash by id              | 200     |
| GET `/renaest/protocolos/{protocolo}`               | consult by transmission protocol | 200     |
| POST `/renaest/sinistros/{idSinistro}/complementos` | submit complement                | 202     |
| POST `/renaest/sinistros/{idSinistro}/correcoes`    | submit correction                | 202     |

**Field vocabulary** (Portuguese camelCase): `idSinistro`, `protocolo`,
`situacao`, `dataHoraSinistro`, `uf`, `codigoMunicipio`, `local`, `gravidade`,
`veiculos`, `pessoas`, `vitimas`, `condicoesVia`, `condicoesMeteorologicas`,
`referencias` (`renavam` / `cpfCondutor` / `numeroAit`), `orgaoResponsavel`,
`dataTransmissao`.

## Surface: SNE (electronic notifications)

National electronic-notification base (`INV-SNE-001`). Behavior:
[`../arch/national-extensions-workflows.md`](../arch/national-extensions-workflows.md).

| Ported path (`/v1`)                               | Purpose              | Success |
| ------------------------------------------------- | -------------------- | ------- |
| GET `/sne/adesoes/veiculos/{placa}`               | vehicle adherence    | 200     |
| GET `/sne/adesoes/cidadaos/{cpf}`                 | citizen adherence    | 200     |
| GET `/sne/orgaos/{codigoOrgaoAutuador}/adesao`    | agency adherence     | 200     |
| POST `/sne/notificacoes/autuacao`                 | notify autuação      | 201     |
| POST `/sne/notificacoes/penalidade`               | notify penalidade    | 201     |
| GET `/sne/notificacoes/{protocolo}`               | consult notification | 200     |
| POST `/sne/notificacoes/{protocolo}/cancelamento` | cancel notification  | 200     |

**Field vocabulary**: `protocolo`, `numeroAit`, `idProcesso`, `tipoNotificacao`,
`codigoOrgaoAutuador`, `placa`, `cpfDestinatario`, `situacao`, `canal`,
`dataNotificacao`, `dataDisponibilizacao`, `dataCiencia`, `prazoLegal`, `mensagem`.

## Surface: CDT (citizen-channel projection)

A deterministic projection of national data — **not** an identity provider or app
backend (`INV-CDT-001`).

| Ported path (`/v1`)                              | Purpose                     | Success |
| ------------------------------------------------ | --------------------------- | ------- |
| GET `/cdt/cidadaos/{cpf}/notificacoes`           | citizen-visible SNE notices | 200     |
| GET `/cdt/cidadaos/{cpf}/infracoes`              | citizen-visible infractions | 200     |
| GET `/cdt/cidadaos/{cpf}/veiculos`               | owned vehicles              | 200     |
| GET `/cdt/cidadaos/{cpf}/cnh`                    | CNH summary                 | 200     |
| GET `/cdt/infracoes/{numeroAit}/pagamento`       | payment/discount projection | 200     |
| POST `/cdt/infracoes/{numeroAit}/reconhecimento` | recognize (unlock discount) | 200     |

**Field vocabulary**: `cpf`, `notificacoes`, `infracoes`, `veiculos`, `cnh`,
`numeroAit`, `situacao`, `valorOriginal`, `valorComDesconto`, `percentualDesconto`,
`boletoDisponivel`, `linhaDigitavel`, `dataVencimento`, `origem`, `protocoloSne`,
`protocoloRenainf`.

## Surface: State-DETRAN national-base bridge

A state DETRAN acting against the national bases — **only** national-base
interactions, never UF-proprietary APIs (`INV-DETRAN-001`; boundary above).

| Ported path (`/v1`)                                   | Bridges to | Success |
| ----------------------------------------------------- | ---------- | ------- |
| POST `/detrans/{uf}/renavam/consultasVeiculo`         | RENAVAM    | 201     |
| POST `/detrans/{uf}/renach/consultasCondutor`         | RENACH     | 201     |
| POST `/detrans/{uf}/renainf/autosInfracao`            | RENAINF    | 201     |
| GET `/detrans/{uf}/renainf/autosInfracao/{numeroAit}` | RENAINF    | 200     |
| POST `/detrans/{uf}/renaest/sinistros`                | RENAEST    | 201     |
| POST `/detrans/{uf}/sne/notificacoes`                 | SNE        | 201     |

**Field vocabulary**: `uf`, `codigoOrgao`, `perfilIntegracao`, `versaoLeiaute`,
`protocoloDetran`, `protocoloNacional`, `sistemaNacional`, `situacao`, `retorno`.
