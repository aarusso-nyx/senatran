# Architecture

## Goal

Expose a stable canonical REST API for DETRAN-facing systems while hiding the heterogeneity of official SENATRAN/SERPRO integrations.

```text
Client System
    ↓ REST/OpenAPI
Canonical SENATRAN Gateway
    ↓
Domain Adapter
    ↓ SOAP/XML, REST, queue, batch file, or official service
    ↓
RENACH / RENAINF / SERPRO / SENATRAN
```

## Principles

- Do not leak official legacy contracts to application systems.
- Preserve idempotency for transactional operations.
- Store full payloads and hashes for auditability.
- Every state transition must be auditable.
- Every external call must have a correlation id.
- Treat official RENACH/RENAINF contracts as adapter implementation details.
- Keep canonical DTOs stable even if official service contracts change.

## Layers

```text
controllers/
  renach/
  renainf/

domain/
  processes/
  exams/
  infractions/
  appeals/

adapters/
  senatran-renach-soap/
  senatran-renainf-soap/
  detran-state-db/
  document-storage/
  sne/

schemas/
  canonical/
  official-mapping/

audit/
  event-log
  payload-hash
  signature-validation
```

## Sync/async behavior

Use synchronous responses for validation and immediate state mutation. Use `202 Accepted` when official service processing is asynchronous or depends on batch confirmation.

## Required headers

```http
Authorization: Bearer <jwt>
X-Client-Cert-Subject: <ICP-Brasil/mTLS subject>
X-Agency-Code: <codigo-orgao>
X-Correlation-Id: <uuid>
Idempotency-Key: <uuid>
```
