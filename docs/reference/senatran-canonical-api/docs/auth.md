# Authentication and authorization

## Recommended model

- mTLS with ICP-Brasil or equivalent organizational certificate.
- OAuth2/JWT between internal systems and the canonical gateway.
- Role-based authorization at endpoint and operation level.
- Strong audit binding between user, certificate, organization and payload hash.

## Logical roles

```text
DETRAN_ADMIN
DETRAN_MEDICAL_AUTHORITY
CLINIC_OPERATOR
MEDICAL_EXAMINER
PSYCHOLOGIST
TRAFFIC_AGENT
TRAFFIC_AUTHORITY
JARI_OPERATOR
SECOND_INSTANCE_OPERATOR
SYSTEM_INTEGRATOR
```

## Security requirements

- All write operations must be idempotent.
- All critical write operations must store payload hash.
- Medical and psychological records must be access-controlled by least privilege.
- Evidence and attachments should be stored out-of-band and referenced by hash and storage id.
- Digital signatures should be verified by adapter or gateway depending on deployment architecture.
