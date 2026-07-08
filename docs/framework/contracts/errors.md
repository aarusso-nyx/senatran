# Error catalog — SENATRAN mock

All endpoints — read (WSDenatran) and transactional (RENACH/RENAINF) — return the
same error envelope:

```json
{
  "returnCode": 402,
  "message": "RENACH.EXAMINER.NOT_ACCREDITED — Profissional não credenciado para o tipo de exame informado."
}
```

`returnCode` echoes the HTTP status. For the transactional endpoints, the canonical
domain error code is carried as the `message` prefix (`CODE — descrição`), so
consumers can branch on the code while the envelope stays WSDenatran-uniform.

## Status semantics (both surfaces)

| HTTP | Meaning                                                                    |
| ---- | -------------------------------------------------------------------------- |
| 400  | Requisição inválida (parâmetro/payload obrigatório ausente ou malformado). |
| 401  | Não autorizado (falha na autenticação do certificado ou do CPF).           |
| 402  | Requisição falhou por regra de negócio / violação de máquina de estado.    |
| 404  | Recurso não encontrado.                                                    |
| 500  | Erro interno.                                                              |

## RENACH domain codes

| Code                                   | HTTP | When                                               |
| -------------------------------------- | ---- | -------------------------------------------------- |
| `RENACH.PROCESS.NOT_FOUND`             | 404  | processo RENACH inexistente.                       |
| `RENACH.PROCESS.ALREADY_OPEN`          | 402  | já existe processo ativo para o CPF e tipo.        |
| `RENACH.PROCESS.BLOCKED`               | 402  | processo bloqueado.                                |
| `RENACH.PROCESS.EXPIRED`               | 402  | processo expirado.                                 |
| `RENACH.PROCESS.INVALID_STATUS`        | 402  | transição inválida para a situação atual.          |
| `RENACH.EXAM.INVALID_TYPE`             | 402  | tipo de exame incompatível com o tipo de processo. |
| `RENACH.EXAM.ALREADY_RECORDED`         | 402  | exame já registrado para o processo.               |
| `RENACH.EXAM.RESULT_NOT_ALLOWED`       | 402  | resultado não permitido no contexto.               |
| `RENACH.EXAM.REQUIRES_BOARD`           | 402  | resultado exige junta médica.                      |
| `RENACH.CLINIC.NOT_ACCREDITED`         | 402  | clínica não credenciada.                           |
| `RENACH.CLINIC.INACTIVE`               | 402  | clínica inativa.                                   |
| `RENACH.EXAMINER.NOT_ACCREDITED`       | 402  | profissional não credenciado.                      |
| `RENACH.EXAMINER.NOT_LINKED_TO_CLINIC` | 402  | profissional não vinculado à clínica.              |
| `RENACH.BIOMETRY.NOT_MATCHED`          | 402  | biometria não confere no check-in.                 |
| `RENACH.SIGNATURE.INVALID`             | 402  | assinatura digital inválida.                       |
| `RENACH.RECTIFICATION.NOT_ALLOWED`     | 402  | retificação não permitida.                         |

## RENAINF domain codes

| Code                                        | HTTP | When                                             |
| ------------------------------------------- | ---- | ------------------------------------------------ |
| `RENAINF.AIT.DUPLICATED`                    | 402  | AIT já lavrado (número duplicado).               |
| `RENAINF.AIT.INVALID_NUMBER`                | 400  | número de AIT inválido.                          |
| `RENAINF.AIT.INVALID_INFRACTION_CODE`       | 400  | código de infração inválido.                     |
| `RENAINF.DRIVER.CPF_REQUIRED`               | 400  | cpf do condutor indicado obrigatório.            |
| `RENAINF.AIT.INVALID_AGENT`                 | 402  | agente inativo/não vinculado ao órgão.           |
| `RENAINF.AIT.INVALID_DEVICE`                | 402  | dispositivo/talonário não homologado.            |
| `RENAINF.AIT.OUT_OF_RANGE`                  | 402  | número fora da faixa reservada.                  |
| `RENAINF.AIT.TRANSMISSION_EXPIRED`          | 402  | prazo de transmissão expirado.                   |
| `RENAINF.AIT.EVIDENCE_REQUIRED`             | 402  | evidência obrigatória ausente.                   |
| `RENAINF.AIT.CANCELLATION_NOT_ALLOWED`      | 402  | cancelamento não permitido.                      |
| `RENAINF.CASE.NOT_FOUND`                    | 404  | processo administrativo inexistente.             |
| `RENAINF.CASE.INVALID_STATUS`               | 402  | transição inválida para a situação do processo.  |
| `RENAINF.NOTICE.DEADLINE_EXPIRED`           | 402  | prazo da notificação expirado.                   |
| `RENAINF.DEFENSE.NOT_ALLOWED`               | 402  | defesa não cabível na fase atual.                |
| `RENAINF.DEFENSE.LATE_SUBMISSION`           | 402  | defesa apresentada fora do prazo.                |
| `RENAINF.DEFENSE.INVALID_ACTOR`             | 402  | requerente não legitimado.                       |
| `RENAINF.APPEAL.INVALID_INSTANCE`           | 402  | instância de recurso inválida.                   |
| `RENAINF.APPEAL.PREVIOUS_INSTANCE_REQUIRED` | 402  | recurso JARI exigido antes da segunda instância. |
| `RENAINF.PENALTY.ALREADY_IMPOSED`           | 402  | penalidade já imposta.                           |
| `RENAINF.PAYMENT.ALREADY_SETTLED`           | 402  | débito já quitado.                               |
| `RENAINF.SNE.NOT_ADHERED`                   | 402  | órgão não aderente ao SNE.                       |

## RENAEST domain codes (national extension)

RENAEST is the national crash/sinister base (extensão nacional — see
`national-extensions-mapping.md`). It follows the same envelope and status
semantics as RENACH/RENAINF.

| Code                                   | HTTP | When                                                   |
| -------------------------------------- | ---- | ------------------------------------------------------ |
| `RENAEST.CRASH.NOT_FOUND`              | 404  | sinistro/protocolo inexistente.                        |
| `RENAEST.CRASH.INVALID_LAYOUT`         | 400  | versão de leiaute não suportada / corpo malformado.    |
| `RENAEST.CRASH.INCOMPLETE_DATA`        | 402  | dados de vítima/local obrigatórios ausentes.           |
| `RENAEST.CRASH.DUPLICATED`             | 402  | reenvio da mesma tupla natural sem `Idempotency-Key`.  |
| `RENAEST.CRASH.CORRECTION_NOT_ALLOWED` | 402  | complemento/correção em registro em situação terminal. |

## SNE domain codes (national extension)

| Code                              | HTTP | When                                                   |
| --------------------------------- | ---- | ------------------------------------------------------ |
| `SNE.NOTIFICATION.NOT_FOUND`      | 404  | protocolo de notificação inexistente.                  |
| `SNE.AGENCY.NOT_ADHERED`          | 402  | órgão autuador não aderente ao SNE.                    |
| `SNE.NOT_ADHERED`                 | 402  | destinatário (veículo/cidadão) não aderente.           |
| `SNE.NOTICE.DEADLINE_EXPIRED`     | 402  | prazo legal da notificação expirado.                   |
| `SNE.NOTIFICATION.INVALID_STATUS` | 402  | duplicidade sem chave / cancelamento de nota terminal. |

## CDT domain codes (national extension)

| Code                          | HTTP | When                                                |
| ----------------------------- | ---- | --------------------------------------------------- |
| `CDT.CITIZEN.NOT_FOUND`       | 404  | cidadão sem condutor/veículo/débito conhecido.      |
| `CDT.INFRACTION.NOT_FOUND`    | 404  | infração (numeroAit) inexistente na projeção.       |
| `CDT.DISCOUNT.NOT_AVAILABLE`  | 402  | reconhecimento sem desconto/boleto disponível.      |
| `CDT.RECOGNITION.NOT_ALLOWED` | 402  | reconhecimento em infração terminal/já reconhecida. |

## DETRAN bridge domain codes (national extension)

| Code                       | HTTP | When                                               |
| -------------------------- | ---- | -------------------------------------------------- |
| `DETRAN.PROFILE.NOT_FOUND` | 404  | UF sem perfil de integração à base nacional.       |
| `DETRAN.PROFILE.INACTIVE`  | 402  | perfil da UF inativo/suspenso.                     |
| `DETRAN.LAYOUT.INVALID`    | 400  | versão de leiaute incompatível com o perfil da UF. |
| `DETRAN.BRIDGE.REJECTED`   | 402  | bridge rejeitado (perfil em homologação pendente). |

## Enforcement status

Actively enforced by the services (each has a test): all `*.NOT_FOUND`,
`RENACH.PROCESS.INVALID_STATUS`, `RENACH.PROCESS.ALREADY_OPEN`,
`RENACH.EXAM.INVALID_TYPE`,
`RENACH.EXAM.ALREADY_RECORDED`, `RENACH.CLINIC.NOT_ACCREDITED`/`INACTIVE`,
`RENACH.EXAMINER.NOT_ACCREDITED`, `RENAINF.AIT.DUPLICATED`,
`RENAINF.AIT.INVALID_NUMBER`/`INVALID_INFRACTION_CODE` (400 via DTO),
`RENAINF.AIT.INVALID_DEVICE`, `RENAINF.AIT.EVIDENCE_REQUIRED`,
`RENAINF.AIT.OUT_OF_RANGE`, `RENAINF.CASE.INVALID_STATUS`,
`RENAINF.DEFENSE.NOT_ALLOWED`, `RENAINF.PENALTY.ALREADY_IMPOSED`,
`RENAINF.APPEAL.INVALID_INSTANCE`/`PREVIOUS_INSTANCE_REQUIRED`,
`RENAINF.PAYMENT.ALREADY_SETTLED`, `RENAINF.AIT.TRANSMISSION_EXPIRED`,
`RENAINF.NOTICE.DEADLINE_EXPIRED`, `RENAINF.DEFENSE.LATE_SUBMISSION`,
`RENAINF.SNE.NOT_ADHERED`.

The four deadline/SNE rules are enforced **deterministically** — each compares a
date supplied in the request body against a deadline derived from stored dates
(never the wall clock), so results are reproducible. Triggers (also published in
`database/seed/manifest.json`): a `dataTransmissao` more than 30 days after the
infraction → `TRANSMISSION_EXPIRED`; a `dataNotificacao` more than 30 days after
the infraction → `NOTICE.DEADLINE_EXPIRED`; a defesa `dataProtocolo` after the
case `prazoDefesa` (notice + 30 days; fixture `A0001001` carries a past one) →
`DEFENSE.LATE_SUBMISSION`; `canalNotificacao: SNE` on the non-adherent fixture
device `DEV-0001` → `SNE.NOT_ADHERED`.

All five RENAEST codes are actively enforced and tested:
`RENAEST.CRASH.NOT_FOUND` (unknown `idSinistro`/`protocolo`),
`RENAEST.CRASH.INVALID_LAYOUT` (a `versaoLeiaute` other than `1.0`),
`RENAEST.CRASH.INCOMPLETE_DATA` (a `COM_VITIMA_*` gravidade with no `vitimas`, or
a missing `local`), `RENAEST.CRASH.DUPLICATED` (a same-tuple resubmit without an
`Idempotency-Key`), and `RENAEST.CRASH.CORRECTION_NOT_ALLOWED` (complement/
correction on a terminal record). RENAEST also honours the `codigoMunicipio`
`9999999` magic key → 500 (`scenarios.md`).

All SNE, CDT and DETRAN-bridge codes are likewise actively enforced and tested
(each has an e2e case). SNE's `NOTICE.DEADLINE_EXPIRED` is deterministic (body
`dataNotificacao` vs `dataInfracao + 30d`, never the wall clock). The national
extensions add magic keys (`scenarios.md`): `codigoOrgaoAutuador` `999999` → 500
(SNE/DETRAN), `numeroAit` `A0000500` → 500 (CDT), `uf` `ZZ` → 500 (DETRAN).

Modeled in this catalog but **not yet enforced** (they need biometric/signature
verification data the mock does not carry): `RENACH.BIOMETRY.NOT_MATCHED`,
`RENACH.SIGNATURE.INVALID`. These remain documented for consumers and are safe to
add when the corresponding state is introduced.

## WSDenatran read endpoints

The 57 read endpoints use the same status table. They have no domain error codes;
`message` carries a plain description. Forced-scenario magic keys and the
data-driven 200/404 behavior are documented in `scenarios.md`.
