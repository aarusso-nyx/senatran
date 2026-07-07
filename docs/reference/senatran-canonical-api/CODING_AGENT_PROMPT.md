# Coding Agent Instructions

You are implementing a canonical SENATRAN integration gateway.

## Do

- Use `openapi.yaml` as the API source of truth.
- Validate inbound requests using JSON schemas in `schemas/`.
- Implement idempotency on all write operations.
- Store the original canonical payload and a payload hash.
- Emit audit events on every state transition.
- Keep official RENACH/RENAINF contracts behind adapter interfaces.
- Return canonical envelopes consistently.

## Do not

- Claim this package reproduces official SENATRAN/SERPRO WSDL/XSD.
- Hard-code official endpoint names until real contracts are supplied.
- Let client systems depend directly on SOAP/XML details.
- Ignore medical/psychological access control.

## Suggested first implementation

1. Generate TypeScript DTOs from JSON Schema/OpenAPI.
2. Implement NestJS or Express controllers from `openapi.yaml`.
3. Create Postgres tables using `mock/postgres/schema.sql`.
4. Implement in-memory/mock adapter returning canonical responses.
5. Add adapter interface with methods:
   - registerMedicalExam
   - registerPsychologicalEvaluation
   - createInfractionNotice
   - openAdministrativeCase
   - submitPreliminaryDefense
   - submitAppeal
6. Later, replace mock adapter with SOAP/XML or official REST mapping.
