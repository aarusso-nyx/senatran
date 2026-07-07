# RENAINF workflows — talonário, AIT, autuação, defesa and recurso

## State machine

```text
DRAFT
  ↓
ISSUED
  ↓
SIGNED
  ↓
TRANSMITTED
  ↓
RECEIVED
  ↓
VALIDATED / REJECTED
  ↓
AUTUACAO_OPENED
  ↓
NA_SENT
  ↓
AWAITING_DRIVER_IDENTIFICATION / AWAITING_PRELIMINARY_DEFENSE
  ↓
DEFENSE_SUBMITTED
  ↓
DEFENSE_ACCEPTED / DEFENSE_REJECTED
  ↓
PENALTY_IMPOSED
  ↓
NP_SENT
  ↓
JARI_APPEAL_SUBMITTED
  ↓
JARI_UPHELD / JARI_DENIED
  ↓
SECOND_INSTANCE_SUBMITTED
  ↓
FINAL_DECISION / ARCHIVED
```

## Operational workflow

```text
Talonário autorizado
  ↓
AIT lavrado no dispositivo
  ↓
Assinatura agente/condutor if applicable
  ↓
Transmission online or posterior batch
  ↓
Reception by autuador agency
  ↓
Validation and consistency
  ↓
RENAINF/state registration
  ↓
Notificação de autuação
  ↓
Driver identification / preliminary defense
  ↓
Defense decision
  ↓
Penalty notification
  ↓
JARI appeal
  ↓
Second-instance appeal
  ↓
Final administrative decision
```

## Business rules

| Code         | Rule                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| RENAINF.R001 | AIT inicia o processo administrativo de imposição de penalidade.                                                          |
| RENAINF.R002 | Talonário eletrônico deve estar homologado/autorizado.                                                                    |
| RENAINF.R003 | Agente deve estar ativo e vinculado ao órgão autuador.                                                                    |
| RENAINF.R004 | AIT deve conter órgão, agente, veículo/condutor quando aplicável, local, data/hora, enquadramento e evidências exigíveis. |
| RENAINF.R005 | AIT offline deve preservar assinatura, hash, relógio e trilha de sincronização.                                           |
| RENAINF.R006 | Notificação de autuação deve abrir prazo para indicação de condutor e defesa prévia quando cabível.                       |
| RENAINF.R007 | Defesa/recurso deve referir-se a um único AIT/processo.                                                                   |
| RENAINF.R008 | Legitimados: proprietário, condutor identificado ou representante legal.                                                  |
| RENAINF.R009 | Penalidade só deve ser imposta após fase de autuação e tratamento da defesa prévia.                                       |
| RENAINF.R010 | Recurso JARI antecede recurso de segunda instância.                                                                       |
| RENAINF.R011 | Cancelamento, arquivamento ou provimento deve refletir débito e pontuação.                                                |
| RENAINF.R012 | SNE, quando aderido, substitui fluxo físico conforme regras próprias.                                                     |
