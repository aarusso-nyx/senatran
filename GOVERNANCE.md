# GOVERNANCE.md

`senatran` is a **DEVAI tier3 adopter**. Governance is evidence-based: lightweight
when green, strict only when evidence degrades. This file summarizes how the model
applies here; the canonical axioms are the DEVAI Constitution (pinned 0.3.0, see
`CONSTITUTION.md`).

## 1. Principles

- **Evidence over claims.** Lint, typecheck, tests, contract checks, and the DEVAI
  scorecard produce facts; agents reason over facts, code, tests, and current docs.
- **Separation of concerns.** Execution produces facts; verification interprets
  them; enforcement applies consequences. No step does more than one.
- **Quiet by default.** When gates are green, no extra ceremony. Governance becomes
  visible only when evidence degrades or a checkpoint needs fresh evidence.
- **The contract is the reference signal.** Deviation of code/DB from
  `openapi.yaml` is error to be regulated, not a fait accompli.

## 2. Roles (Constitution Article 6)

Owner · Architect · Inspector · Engineer · Auditor. The human declares one role per
session; it constrains actuatable paths (see `AGENTS.md`). Path-based authority is
enforced at the tool layer, not at review time.

## 3. Artifacts

| Artifact                                    | Purpose                                                   |
| ------------------------------------------- | --------------------------------------------------------- |
| `AGENTS.md` / `CLAUDE.md`                   | Binding behavioral rules for humans and agents.           |
| `.devai/config/*.json`                      | Project metadata, domains, thresholds, forbidden actions. |
| `.devai/state/evidence-chain.json`          | Hash-chained evidence log (append-only).                  |
| `docs/framework/arch/invariants/INV-*.json` | Reference-signal units.                                   |
| `docs/framework/arch/trace.json`            | Invariant ↔ test ↔ code mapping.                          |
| `docs/meta/gov/compliance/`                 | Scorecards and hard-fail catalog.                         |

## 4. Gates (GScore cycles)

Evidence is grouped into three cycles; each gates a wider action:

- **Cycle A — agentic gate.** paths present, build, `lint:src`, contract check,
  hard-fails. Fast and deterministic. Failing blocks agentic coding.
- **Cycle B — commit gate.** + `lint`, `typecheck`, unit, integration. Failing
  blocks commit/branch merge.
- **Cycle C — merge gate.** + e2e, coverage. Failing blocks PR/main merge.

The aggregate local gate is `pnpm check`. DEVAI health is `pnpm devai:doctor` (must
stay 6/6) and `pnpm devai:scorecard`.

## 5. Hard-fails (non-negotiable)

- Weakening the `x-cpf-usuario` auth guard or the `{ returnCode, message }` error
  envelope (either surface) to pass a test.
- Business logic added to a **read** (WSDenatran) controller/service beyond a
  single view read.
- A **transactional** (RENACH/RENAINF) write that mutates state without enforcing
  the state machine, without idempotency, or without writing an `audit.evento`
  (INV-RENACH/RENAINF/IDEMP).
- Pointing any config at real SENATRAN endpoints or real personal data.
- Editing `.devai/constitution.md` or `docs/framework/schemas/` outside an
  Architect-led change.
- Non-parameterized SQL built from request input.

## 6. Evidence

Phase boundaries emit an evidence record:
`pnpm devai evidence-emit <verb.noun> --actor <name> --actor-role <role> --status
completed --note "…"`. The Auditor walks the chain; chain drift is an audit
failure. Coverage and test reports land under `.devai/state/`.

## 7. Remediation

When a gate degrades: reproduce the failing fact, fix the smallest cause, re-run
the gate, emit fresh evidence. Do not disable a check to make it pass.
