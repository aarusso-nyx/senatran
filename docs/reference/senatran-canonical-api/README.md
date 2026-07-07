# SENATRAN Canonical API — RENACH & RENAINF v0.1

This package is a canonical, reconstruction-oriented API specification for building mock services, rock-services, gateways and adapters for SENATRAN/DETRAN integrations.

## Important scope note

This repository does **not** claim to reproduce official SENATRAN/SERPRO WSDL, XSD, OpenAPI or proprietary contracts.

It provides a modern canonical REST/OpenAPI model inferred from public administrative workflows and traffic-domain rules, intended to be mapped to official services when a DETRAN, authorized vendor or accredited integrator has access to the actual contracts.

## Included domains

1. RENACH subset:
   - medical exams;
   - psychological evaluations;
   - clinics;
   - accredited professionals;
   - scheduling;
   - medical boards;
   - first license;
   - renewal;
   - category addition/change.

2. RENAINF subset:
   - electronic ticketing device/talonário;
   - AIT;
   - autuação;
   - driver identification;
   - preliminary defense;
   - penalty;
   - JARI appeal;
   - second-instance appeal;
   - payment/settlement;
   - eventing.

## Repository layout

```text
docs/
  architecture.md
  auth.md
  errors.md
  renach-workflows.md
  renainf-workflows.md

openapi.yaml

schemas/
  renach/
  renainf/

examples/
  renach/
  renainf/

mock/
  postgres/
    schema.sql
    seed.sql

adapters/
  README/
    mapping-guidance.md
```

## Recommended use by coding agents

1. Read `docs/architecture.md`.
2. Use `openapi.yaml` as the canonical API surface.
3. Use schemas under `schemas/` to generate validators and DTOs.
4. Use examples under `examples/` for unit tests and fixtures.
5. Use `mock/postgres/schema.sql` for a minimal persistence layer.
6. Implement adapters behind the canonical service boundary.
7. Maintain an explicit mapping table from each canonical endpoint to the official SOAP/XML/REST operation once official contracts are available.

## Version

Canonical version: `0.1.0`
Generated: 2026-07-07T01:42:58.679970
