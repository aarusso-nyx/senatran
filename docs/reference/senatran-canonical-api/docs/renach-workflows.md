# RENACH workflows — clinics, medical exams and psychological evaluations

## Covered processes

- First license
- Renewal
- Category addition
- Category change

## State machine

```text
OPEN
  ↓
AWAITING_MEDICAL
  ↓
SCHEDULED
  ↓
IN_EXAM
  ↓
EXAM_RECORDED
  ↓
AWAITING_PSYCHOLOGICAL, UNDER_REVIEW, APPROVED, REJECTED
```

## Exam workflow

```text
Process exists
  ↓
Eligibility check
  ↓
Clinic/professional validation
  ↓
Appointment
  ↓
Check-in and biometric validation
  ↓
Medical exam / Psychological evaluation
  ↓
Result recording
  ↓
Restriction and validity consolidation
  ↓
Board referral when needed
```

## Business rules

| Code        | Rule                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------ |
| RENACH.R001 | Processo deve existir e estar aberto.                                                            |
| RENACH.R002 | Tipo de exame deve ser compatível com o tipo de processo.                                        |
| RENACH.R003 | Clínica deve estar ativa e credenciada no DETRAN/UF.                                             |
| RENACH.R004 | Profissional deve estar ativo, credenciado e vinculado à clínica.                                |
| RENACH.R005 | Exame médico é obrigatório para primeira habilitação, renovação, adição ou mudança de categoria. |
| RENACH.R006 | Avaliação psicológica é exigível nos casos normativos aplicáveis.                                |
| RENACH.R007 | Resultado temporariamente inapto deve gerar prazo/condição de retorno.                           |
| RENACH.R008 | Resultado inapto deve bloquear avanço do processo até revisão/junta, quando cabível.             |
| RENACH.R009 | Restrições médicas devem ser codificadas e refletidas na CNH.                                    |
| RENACH.R010 | Toda alteração/retificação deve gerar trilha de auditoria.                                       |
