# Prompt — adopt the SENATRAN mock as the integration target

Copy everything in the fenced block below into an agent session **inside a
sibling repo** (`pec`, `teat`, …) to replace that repo's home-grown SENATRAN /
DENATRAN mock or stub with the shared, contract-faithful `senatran` mock.

The prompt is deliberately self-contained; the only thing you may need to adjust
is the path/URL to the `senatran` checkout if it is not a sibling directory.

---

```text
GOAL
Replace this repository's own mock/stub/fake of the SENATRAN/DENATRAN APIs with
the shared `senatran` mock service, so every sibling integrates against one
deterministic, contract-faithful source of truth instead of divergent local
fakes.

WHAT `senatran` IS (rely on this — do not re-implement it)
- A dev-only mock provider for SENATRAN/DENATRAN. Deterministic seed, stateful
  transactional flows, faithful error envelopes. Never holds real data.
- Source: https://github.com/aarusso-nyx/senatran — usually checked out next to
  this repo at ../senatran.
- Bring it up (no local Node/Postgres needed):
      cd ../senatran && docker compose up --build
  It serves on http://localhost:3000. Readiness: GET /health -> {"status":"ok","db":"up"}.
- ONE convention across all 87 endpoints:
    * base path /v1
    * auth header `x-cpf-usuario` on every request (and `x-client-cert-cn` when
      cert simulation is on)
    * errors are always { "returnCode": <int>, "message": "<text>" }
    * field names are Portuguese camelCase, exactly as the contract declares
- Two surfaces, same convention:
    * Read (WSDenatran) — 57 GET endpoints: vehicles, drivers, infractions,
      indicators. Contract: ../senatran/docs/framework/contracts/openapi.yaml
    * Transactional (RENACH/RENAINF) — 30 endpoints: licensing-exam and
      infraction-lifecycle workflows (stateful, idempotent).
      Contract: ../senatran/docs/framework/contracts/openapi-transactional.yaml
  The contracts are the source of truth. Both ship response `example`s.

DETERMINISTIC FIXTURES & MAGIC KEYS (use these; do NOT invent test data)
The authoritative, machine-readable list is ../senatran/database/seed/manifest.json.
Read it and drive tests from it. Essentials:
- Auth (non-secret dev fixtures):
    x-cpf-usuario: 12345678909
    x-client-cert-cn: senatran-dev-client
  Reserved x-cpf-usuario 00000000000 always -> 401.
- Known-good read fixtures:
    placa ABC1D23  -> vehicle, all restriction indicators clear
    placa IND1I01  -> vehicle with alarme + roubo/furto + transferência + penhora
    placa ABC1234  -> legacy plate, PJ (CNPJ) owner
    chassi 9BWZZZ377VT004251, renavam 00123456780 (all -> ABC1D23)
    condutor cpf 52998224725 ; proprietário cnpj 11444777000161
- Transactional fixtures:
    RENACH process RS123456789 (at AGUARDANDO_MEDICO)
    credentialed clinic RS-CLINIC-0001 ; a credentialed CRM examiner (see manifest)
    RENAINF AIT A0001001 ; SNE-non-adherent device DEV-0001
- Magic keys (force a status deterministically, independent of data):
    placa ERR2A02 -> 402 ; placa ERR5A00 -> 500
    chassi ERR00000000000402/…500 ; cpf 00000000402/…500 ;
    cnpj 00000000000402/…500 ; renavam 00000000402/…500
  A well-formed but absent identifier -> 404.

YOUR TASK
1. DISCOVER. Find everywhere this repo mocks, stubs, fakes, records, or
   hard-codes SENATRAN/DENATRAN responses (HTTP mocks, fixture JSON, wiremock/
   nock/msw handlers, in-memory fakes, test doubles, hand-written stub clients).
   List them with file paths.
2. PROPOSE a short migration plan BEFORE editing: the stub sites you found, the
   single HTTP client that will replace them, and the config switch. Wait for my
   go-ahead if anything is ambiguous.
3. POINT THE CLIENT at the mock via configuration, not code — e.g.
   SENATRAN_BASE_URL=http://localhost:3000, defaulting to it in dev/test. Make
   the client attach the auth headers above on every request.
4. SWAP TESTS to exercise the running mock (or assert against the published
   manifest fixtures and magic keys) instead of bespoke stub payloads. Keep them
   deterministic by using the fixtures/magic keys — never freshly invented data.
5. REMOVE the now-dead local mock/stub once the suite is green against the mock.
6. MAKE IT REPRODUCIBLE. Add a dev bring-up step so a clean checkout works:
   either document `cd ../senatran && docker compose up`, or add senatran to this
   repo's own compose (e.g. `docker compose -f ../senatran/docker-compose.yml up`),
   and gate the test suite on GET /health.
7. VERIFY by running this repo's tests against the live mock; report pass/fail
   and anything that had to change.

GUARDRAILS
- Dev-only. Never point the mock (or this integration) at real SENATRAN data.
- The contract wins. If this repo expects a field or endpoint the mock does not
  provide, STOP and flag it as a possible contract gap to raise in `senatran` —
  do not fork or patch the mock, and do not silently reshape responses.
- Stay thin: one HTTP client to /v1 + auth headers. Do not re-implement business
  rules (state machines, idempotency, error semantics) the mock already owns.
- The dev cpf/cert are non-secret fixtures; do not treat them as credentials, and
  do not commit any real ones.

DELIVERABLE
A PR that removes this repo's local SENATRAN stub, routes the client at the
shared mock, passes the test suite against it deterministically, and adds a short
"Running against the SENATRAN mock" note to the README.
```

---

## Notes for maintainers

- Keep the fixture/magic-key summary above in sync with
  [`database/seed/manifest.json`](../../database/seed/manifest.json) — the
  manifest is the source of truth; this prompt only quotes the essentials.
- If a sibling reports a missing field/endpoint (guardrail #2), treat it as a
  contract-conformance signal for this repo, not a reason for the sibling to
  diverge.
