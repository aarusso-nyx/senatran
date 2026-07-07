# SENATRAN Mock — Documentation

Welcome to the documentation for **`senatran`**, a dev-only mock of the SERPRO
**WSDenatran** public REST API (vehicles, drivers, infractions, indicators). It is
a deterministic integration target for the sibling repositories `pec` and `teat`.

## Start here

- **[Repository README](../../README.md)** — one-page orientation and quick start.
- **[Project context](../../CONTEXT.md)** — architecture, layout, commands.
- **[Build plan](../../BUILD-PLAN.md)** — phased implementation plan and status.
- **[API contract](../framework/contracts/openapi.yaml)** — the authoritative
  WSDenatran surface (OpenAPI 3.1).
- **[Design decisions](../../DESIGN-DECISIONS.md)** — why the design is what it is.
- **[Governance](../../GOVERNANCE.md)** — the evidence-based governance model.

## What this is not

This service is **not** production and must never be connected to real
DENATRAN/SENATRAN systems or real personal data. All data served is synthetic and
reproducible.
