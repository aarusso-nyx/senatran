# Adapter mapping guidance

## Purpose

This directory documents how implementation agents should map the canonical API to official DETRAN/SENATRAN/SERPRO contracts.

## Rule

Never hard-code assumptions that a canonical endpoint equals a single official service. A canonical operation may map to:

- one SOAP operation;
- many SOAP operations;
- one REST call;
- one batch file;
- a queue message;
- a state database operation followed by official synchronization.

## Recommended mapping table

Create a table like:

| Canonical operation                                 | Official system | Official operation | Protocol         | Sync/async | Notes                        |
| --------------------------------------------------- | --------------- | ------------------ | ---------------- | ---------- | ---------------------------- |
| POST /renach/processes/{renachNumber}/medical-exams | RENACH          | TBD                | SOAP/XML         | Sync       | Map after WSDL access        |
| POST /renainf/infraction-notices                    | RENAINF         | TBD                | SOAP/XML or REST | Sync/Async | Depends on agency deployment |

## Implementation strategy

1. Implement canonical DTO validation.
2. Persist request, idempotency key and payload hash.
3. Call official adapter.
4. Normalize official return to canonical envelope.
5. Emit audit event.
6. Emit webhook/domain event when state changes.
