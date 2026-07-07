# Canonical RENACH/RENAINF → WSDenatran unification map

The reference corpus under `docs/reference/senatran-canonical-api/` describes a
_transactional_ RENACH/RENAINF adapter API in an English, Bearer-JWT, Envelope
style. Per the project decision, those endpoints are **ported into the WSDenatran
contract conventions** and served by the same mock. This document is the
authoritative mapping; the ported contract lives in
`openapi-transactional.yaml`, and the adapter/provenance table required by
`docs/reference/.../adapters/README/mapping-guidance.md` is here.

## Convention unification (what changes vs. the reference)

| Aspect       | Reference (canonical)                                                | Ported (WSDenatran-unified)                                                                                         |
| ------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Base path    | `/senatran-adapter/v1`                                               | **`/v1`** (single surface)                                                                                          |
| Auth         | Bearer JWT + `X-Agency-Code` + `X-Correlation-Id`                    | **`x-cpf-usuario`** header (+ cert simulation `x-client-cert-cn`), per `auth.md`                                    |
| Success body | `Envelope { success, protocol, data, … }`                            | **raw JSON** object, as WSDenatran returns                                                                          |
| Error body   | `Envelope { success:false, errors:[{code,message,field,severity}] }` | **`{ returnCode, message }`** (WSDenatran). The canonical error code is carried in `message` as `CODE — descrição`. |
| Status codes | 200/201/202                                                          | 200 (read), 201 (create), 202 (async); errors 400/401/402/404/500. Business-rule violations → **402**.              |
| Field names  | English camelCase (`renachNumber`, `aitNumber`, `processType`)       | **Portuguese camelCase**, reusing WSDenatran vocabulary (`numeroRenach`, `numeroAit`, `tipoProcesso`)               |
| RBAC / roles | JWT roles (MEDICAL_EXAMINER, …)                                      | not in the contract; `x-cpf-usuario` identifies the operator. Roles retained as internal notes only.                |
| Idempotency  | required `Idempotency-Key` header                                    | honored if sent (optional); writes also dedupe on natural keys (`numeroAit`, `numeroRenach`).                       |

Internal behaviors the reference mandates and we keep server-side (not part of the
external contract): payload-hash + audit event on every state transition,
idempotent writes, state-machine enforcement.

## Path mapping

### RENACH

| Reference path (method)                                           | Ported path (`/v1`)                                            | Success |
| ----------------------------------------------------------------- | -------------------------------------------------------------- | ------- |
| GET `/renach/processes/{renachNumber}`                            | GET `/renach/processos/{numeroRenach}`                         | 200     |
| POST `/renach/processes/{renachNumber}/exam-eligibility`          | POST `/renach/processos/{numeroRenach}/elegibilidadeExame`     | 200     |
| GET `/renach/accredited-clinics`                                  | GET `/renach/clinicasCredenciadas`                             | 200     |
| GET `/renach/accredited-professionals`                            | GET `/renach/profissionaisCredenciados`                        | 200     |
| POST `/renach/processes/{renachNumber}/appointments`              | POST `/renach/processos/{numeroRenach}/agendamentos`           | 201     |
| PATCH `/renach/appointments/{appointmentId}`                      | PATCH `/renach/agendamentos/{idAgendamento}`                   | 200     |
| POST `/renach/appointments/{appointmentId}/check-in`              | POST `/renach/agendamentos/{idAgendamento}/checkin`            | 200     |
| POST `/renach/processes/{renachNumber}/medical-exams`             | POST `/renach/processos/{numeroRenach}/examesMedicos`          | 201     |
| POST `/renach/processes/{renachNumber}/psychological-evaluations` | POST `/renach/processos/{numeroRenach}/avaliacoesPsicologicas` | 201     |
| GET `/renach/processes/{renachNumber}/exams`                      | GET `/renach/processos/{numeroRenach}/exames`                  | 200     |
| POST `/renach/exams/{examId}/rectifications`                      | POST `/renach/exames/{idExame}/retificacoes`                   | 202     |
| POST `/renach/processes/{renachNumber}/medical-board-referrals`   | POST `/renach/processos/{numeroRenach}/encaminhamentosJunta`   | 202     |
| POST `/renach/processes/{renachNumber}/medical-board-decisions`   | POST `/renach/processos/{numeroRenach}/pareceresJunta`         | 201     |

### RENAINF

| Reference path (method)                                              | Ported path (`/v1`)                                                           | Success |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| POST `/renainf/talon/devices`                                        | POST `/renainf/talonario/dispositivos`                                        | 201     |
| GET `/renainf/talon/sync`                                            | GET `/renainf/talonario/sincronizacao`                                        | 200     |
| POST `/renainf/talon/ait-number-ranges`                              | POST `/renainf/talonario/faixasNumeracaoAit`                                  | 201     |
| POST `/renainf/infraction-notices`                                   | POST `/renainf/autosInfracao`                                                 | 201     |
| POST `/renainf/infraction-notices/batches`                           | POST `/renainf/autosInfracao/lotes`                                           | 202     |
| GET `/renainf/infraction-notices/{aitNumber}`                        | GET `/renainf/autosInfracao/{numeroAit}`                                      | 200     |
| POST `/renainf/infraction-notices/{aitNumber}/cancellation-requests` | POST `/renainf/autosInfracao/{numeroAit}/solicitacoesCancelamento`            | 202     |
| POST `/renainf/administrative-cases`                                 | POST `/renainf/processosAdministrativos`                                      | 201     |
| POST `/renainf/administrative-cases/{caseId}/notices/autuacao`       | POST `/renainf/processosAdministrativos/{idProcesso}/notificacoes/autuacao`   | 201     |
| POST `/renainf/administrative-cases/{caseId}/driver-identifications` | POST `/renainf/processosAdministrativos/{idProcesso}/indicacoesCondutor`      | 201     |
| POST `/renainf/administrative-cases/{caseId}/preliminary-defenses`   | POST `/renainf/processosAdministrativos/{idProcesso}/defesasPrevias`          | 201     |
| POST `/renainf/administrative-cases/{caseId}/penalties`              | POST `/renainf/processosAdministrativos/{idProcesso}/penalidades`             | 201     |
| POST `/renainf/administrative-cases/{caseId}/notices/penalty`        | POST `/renainf/processosAdministrativos/{idProcesso}/notificacoes/penalidade` | 201     |
| POST `/renainf/administrative-cases/{caseId}/appeals`                | POST `/renainf/processosAdministrativos/{idProcesso}/recursos`                | 201     |
| POST `/renainf/appeals/{appealId}/decision`                          | POST `/renainf/recursos/{idRecurso}/julgamento`                               | 201     |
| GET `/renainf/administrative-cases/{caseId}/financial-obligation`    | GET `/renainf/processosAdministrativos/{idProcesso}/debito`                   | 200     |
| POST `/renainf/administrative-cases/{caseId}/payments`               | POST `/renainf/processosAdministrativos/{idProcesso}/pagamentos`              | 201     |

## Field mapping (English → Portuguese, WSDenatran vocabulary)

Reuse an existing WSDenatran field name wherever the concept already exists.

### RENACH — exame médico / avaliação psicológica

| Canonical                                   | Ported                                          | Notes                                                                                       |
| ------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `appointmentId`                             | `idAgendamento`                                 |                                                                                             |
| `clinic.clinicId` / `clinic.cnpj`           | `clinica.codigoClinica` / `clinica.cnpj`        |                                                                                             |
| `examiner.cpf`                              | `examinador.cpf`                                |                                                                                             |
| `examiner.council` / `councilNumber` / `uf` | `examinador.conselho` / `numeroConselho` / `uf` | council enum CRM/CRP kept                                                                   |
| `candidate.cpf` / `name` / `birthDate`      | `condutor.cpf` / `nome` / `dataNascimento`      | reuses WSDenatran `condutor`, `nome`, `dataNascimento`                                      |
| `process.renachNumber`                      | `processo.numeroRenach`                         |                                                                                             |
| `process.processType`                       | `processo.tipoProcesso`                         | enum PRIMEIRA_HABILITACAO / RENOVACAO / MUDANCA_CATEGORIA / ADICAO_CATEGORIA                |
| `currentCategory` / `requestedCategory`     | `categoriaAtual` / `categoriaPretendida`        | reuses `categoriaAtual`                                                                     |
| `exam.performedAt`                          | `exame.dataRealizacao`                          |                                                                                             |
| `exam.result`                               | `exame.resultado`                               | enum APTO / APTO_COM_RESTRICOES / INAPTO_TEMPORARIO / INAPTO / ENCAMINHADO_JUNTA / PENDENTE |
| `exam.validUntil`                           | `exame.dataValidade`                            |                                                                                             |
| `exam.restrictions[].code/description`      | `exame.restricoes[].codigo/descricao`           | WSDenatran codigo/descricao pair                                                            |
| `exam.observations`                         | `exame.observacoes`                             |                                                                                             |
| `evaluation.testBattery`                    | `avaliacao.bateriaTestes`                       |                                                                                             |
| `digitalSignature`                          | `assinaturaDigital`                             |                                                                                             |
| `attachments`                               | `anexos`                                        |                                                                                             |

### RENAINF — AIT / defesa / recurso

| Canonical                                             | Ported                                                            | Notes                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `aitNumber`                                           | `numeroAit`                                                       | (WSDenatran query side uses `autoInfracao`; write side uses `numeroAit`) |
| `agencyCode`                                          | `codigoOrgaoAutuador`                                             | reuses WSDenatran `codigoOrgaoAutuador`                                  |
| `issuingAgent.cpf` / `registration`                   | `agenteAutuador.cpf` / `matricula`                                |                                                                          |
| `device.deviceId` / `offlineIssued`                   | `dispositivo.idDispositivo` / `lavradoOffline`                    |                                                                          |
| `infraction.code`                                     | `infracao.codigoInfracao`                                         | reuses WSDenatran `codigoInfracao`                                       |
| `infraction.unfolding`                                | `infracao.codigoDesdobramentoInfracao`                            | reuses WSDenatran field                                                  |
| `infraction.description`                              | `infracao.descricaoInfracao`                                      | reuses WSDenatran field                                                  |
| `infraction.occurredAt`                               | `infracao.dataInfracao`                                           |                                                                          |
| `infraction.municipalityCode`                         | `infracao.codigoMunicipio`                                        |                                                                          |
| `infraction.location{description,latitude,longitude}` | `infracao.local{descricao,latitude,longitude}`                    |                                                                          |
| `vehicle.plate` / `renavam` / `uf` / `makeModel`      | `veiculo.placa` / `codigoRenavam` / `uf` / `descricaoMarcaModelo` | reuses WSDenatran names                                                  |
| `driver{approached,cpf,cnhNumber,uf,refusedToSign}`   | `condutor{abordado,cpf,numeroRegistro,uf,recusouAssinar}`         | reuses `numeroRegistro`                                                  |
| `evidence[]{type,hash,contentType,storageUrl}`        | `evidencias[]{tipo,hash,tipoConteudo,urlArmazenamento}`           |                                                                          |
| `signatures.agentSignature/driverSignature`           | `assinaturas.assinaturaAgente/assinaturaCondutor`                 |                                                                          |
| `submittedBy.actorType`                               | `requerente.tipoRequerente`                                       | enum PROPRIETARIO / CONDUTOR_IDENTIFICADO / REPRESENTANTE_LEGAL          |
| `submittedBy.document` / `name`                       | `requerente.numeroDocumento` / `nome`                             |                                                                          |
| `arguments`                                           | `fundamentacao`                                                   |                                                                          |
| `submittedAt`                                         | `dataProtocolo`                                                   |                                                                          |
| `channel`                                             | `canal`                                                           |                                                                          |
| `instance`                                            | `instancia`                                                       | enum JARI / SEGUNDA_INSTANCIA                                            |
| `previousAppealId`                                    | `idRecursoAnterior`                                               |                                                                          |

## Error-code catalog → status

Canonical error codes are preserved and surfaced in the `message` of the
`{ returnCode, message }` envelope. `returnCode` is the HTTP status.

| Class                           | HTTP    | Examples                                                                                                                                                                      |
| ------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not found                       | **404** | `RENACH.PROCESS.NOT_FOUND`, `RENAINF.CASE.NOT_FOUND`                                                                                                                          |
| Validation / bad request        | **400** | `RENAINF.AIT.INVALID_NUMBER`, `RENAINF.AIT.INVALID_INFRACTION_CODE`                                                                                                           |
| Business rule / state violation | **402** | `RENACH.EXAM.REQUIRES_BOARD`, `RENACH.EXAMINER.NOT_ACCREDITED`, `RENAINF.DEFENSE.NOT_ALLOWED`, `RENAINF.APPEAL.PREVIOUS_INSTANCE_REQUIRED`, `RENAINF.PENALTY.ALREADY_IMPOSED` |
| Auth                            | **401** | certificate/CPF failure                                                                                                                                                       |
| Server                          | **500** | unexpected                                                                                                                                                                    |

Full code lists: RENACH and RENAINF sections of `errors.md`. Example message:
`"402 → RENACH.EXAMINER.NOT_ACCREDITED — Profissional não credenciado para o tipo de exame informado."`

## Provenance (canonical → official, TBD)

Per `mapping-guidance.md`, each ported operation ultimately maps to an official
SOAP/REST/batch operation once real contracts are available. That column stays
`TBD` here; the mock implements the canonical behavior deterministically.
