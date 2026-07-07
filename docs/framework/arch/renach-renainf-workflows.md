# RENACH & RENAINF workflows — SENATRAN mock (transactional)

The transactional half of the mock implements two administrative workflows ported
from `docs/reference/senatran-canonical-api/` into WSDenatran conventions
(`../contracts/canonical-mapping.md`). Both are **stateful**: unlike the read-only
WSDenatran queries, these endpoints drive a state machine, enforce business rules
(→ 402), and emit audit events. This document is the behavioral contract.

Status: **design (transposition)** — implemented in P3–P5.

## RENACH — driver-licensing exams

Processes covered: primeira habilitação, renovação, adição de categoria, mudança de
categoria. State field: `situacao`.

### State machine

```text
ABERTO → AGUARDANDO_MEDICO → AGENDADO → EM_EXAME → EXAME_REGISTRADO
      → { AGUARDANDO_PSICOLOGICO | EM_ANALISE | APROVADO | REJEITADO }
```

`ENCAMINHADO_JUNTA` is a side-branch from `EXAME_REGISTRADO`/`EM_ANALISE` when a
result is `ENCAMINHADO_JUNTA`/`INAPTO`; a junta decision (`pareceresJunta`) resolves
back to `EM_ANALISE`/`APROVADO`/`REJEITADO`.

### Exam workflow

processo existe → checagem de elegibilidade → validação de clínica/profissional →
agendamento → check-in + validação biométrica → exame médico / avaliação
psicológica → registro do resultado → consolidação de restrições e validade →
encaminhamento à junta quando necessário.

### Business rules (→ 402 unless noted)

| Code        | Rule                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| RENACH.R001 | Processo deve existir e estar aberto (senão 404 / 402 `PROCESS.INVALID_STATUS`).                                   |
| RENACH.R002 | Tipo de exame compatível com o tipo de processo (`EXAM.INVALID_TYPE`).                                             |
| RENACH.R003 | Clínica ativa e credenciada no DETRAN/UF (`CLINIC.NOT_ACCREDITED`/`CLINIC.INACTIVE`).                              |
| RENACH.R004 | Profissional ativo, credenciado e vinculado à clínica (`EXAMINER.NOT_ACCREDITED`/`EXAMINER.NOT_LINKED_TO_CLINIC`). |
| RENACH.R005 | Exame médico obrigatório para primeira habilitação, renovação, adição ou mudança de categoria.                     |
| RENACH.R006 | Avaliação psicológica exigível nos casos normativos aplicáveis.                                                    |
| RENACH.R007 | Resultado `INAPTO_TEMPORARIO` gera prazo/condição de retorno.                                                      |
| RENACH.R008 | Resultado `INAPTO` bloqueia avanço até revisão/junta (`EXAM.REQUIRES_BOARD`).                                      |
| RENACH.R009 | Restrições médicas codificadas (codigo/descricao) e refletidas na CNH.                                             |
| RENACH.R010 | Toda alteração/retificação gera trilha de auditoria.                                                               |

Extra guards: `EXAM.ALREADY_RECORDED` (duplicate exam), `EXAM.RESULT_NOT_ALLOWED`,
`RECTIFICATION.NOT_ALLOWED`, `BIOMETRY.NOT_MATCHED`, `SIGNATURE.INVALID`.

## RENAINF — infraction lifecycle

Talonário → AIT → autuação → defesa → penalidade → recurso. State field: `situacao`.

### State machine

```text
RASCUNHO → EMITIDO → ASSINADO → TRANSMITIDO → RECEBIDO → { VALIDADO | REJEITADO }
        → AUTUACAO_ABERTA → NOTIFICADO_AUTUACAO
        → { AGUARDANDO_INDICACAO_CONDUTOR | AGUARDANDO_DEFESA_PREVIA }
        → DEFESA_APRESENTADA → { DEFESA_ACEITA | DEFESA_REJEITADA }
        → PENALIDADE_IMPOSTA → NOTIFICADO_PENALIDADE
        → RECURSO_JARI_APRESENTADO → { JARI_PROVIDO | JARI_NEGADO }
        → SEGUNDA_INSTANCIA_APRESENTADA → { DECISAO_FINAL | ARQUIVADO }
```

### Operational workflow

talonário autorizado → AIT lavrado no dispositivo → assinatura agente/condutor →
transmissão online ou lote posterior → recepção pelo órgão autuador → validação e
consistência → registro RENAINF/estadual → notificação de autuação → indicação de
condutor / defesa prévia → decisão da defesa → notificação de penalidade → recurso
JARI → recurso de segunda instância → decisão administrativa final.

### Business rules (→ 402 unless noted)

| Code         | Rule                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| RENAINF.R001 | AIT inicia o processo administrativo de imposição de penalidade.                                                                                   |
| RENAINF.R002 | Talonário eletrônico homologado/autorizado (`AIT.INVALID_DEVICE`).                                                                                 |
| RENAINF.R003 | Agente ativo e vinculado ao órgão autuador (`AIT.INVALID_AGENT`).                                                                                  |
| RENAINF.R004 | AIT contém órgão, agente, veículo/condutor, local, data/hora, enquadramento e evidências exigíveis (`AIT.EVIDENCE_REQUIRED`, 400 `AIT.INVALID_*`). |
| RENAINF.R005 | AIT offline preserva assinatura, hash, relógio e trilha de sincronização.                                                                          |
| RENAINF.R006 | Notificação de autuação abre prazo para indicação de condutor e defesa prévia (`NOTICE.DEADLINE_EXPIRED`).                                         |
| RENAINF.R007 | Defesa/recurso refere-se a um único AIT/processo.                                                                                                  |
| RENAINF.R008 | Legitimados: proprietário, condutor identificado ou representante legal (`DEFENSE.INVALID_ACTOR`).                                                 |
| RENAINF.R009 | Penalidade só após autuação e tratamento da defesa prévia (`PENALTY.ALREADY_IMPOSED`, `CASE.INVALID_STATUS`).                                      |
| RENAINF.R010 | Recurso JARI antecede recurso de segunda instância (`APPEAL.PREVIOUS_INSTANCE_REQUIRED`, `APPEAL.INVALID_INSTANCE`).                               |
| RENAINF.R011 | Cancelamento/arquivamento/provimento reflete débito e pontuação.                                                                                   |
| RENAINF.R012 | SNE, quando aderido, substitui fluxo físico (`SNE.NOT_ADHERED`).                                                                                   |

Extra guards: `AIT.DUPLICATED` (409→ mapped 402), `AIT.OUT_OF_RANGE`,
`AIT.TRANSMISSION_EXPIRED`, `AIT.CANCELLATION_NOT_ALLOWED`, `DEFENSE.LATE_SUBMISSION`,
`PAYMENT.ALREADY_SETTLED`.

## Cross-cutting behavior (server-side)

- **Idempotency** — writes dedupe on their natural key (`numeroRenach`+operation,
  `numeroAit`, `idProcesso`+phase) and honor an optional `Idempotency-Key` header;
  a replay returns the original result, not a duplicate.
- **Audit** — every state transition writes an `audit.evento` row with the payload
  and a SHA-256 payload hash (`architecture.md` auditability principle).
- **Async** — operations the reference marks 202 (retificações, encaminhamento à
  junta, lotes de AIT, solicitações de cancelamento) return `{ protocolo, situacao }`
  and complete out of band.

All error bodies are the WSDenatran `{ returnCode, message }`; the domain code is
carried in `message` (see `../contracts/canonical-mapping.md` and
`../contracts/errors.md`).
