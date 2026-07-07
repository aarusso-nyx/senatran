# Authentication — SENATRAN mock

The real SERPRO WSDenatran service authenticates callers with **two** factors:

1. a registered **mTLS client certificate** ("cadastro do certificado"), and
2. a required **`x-cpf-usuario`** header identifying the operator making the call.

A `401` is returned when either the certificate or the CPF fails authentication.

Because this repository is a **dev-only mock**, it reproduces that model as a
**header simulation** — no real TLS handshake, no real certificates — so that
sibling consumers (`pec`, `teat`) can exercise realistic success and failure paths
offline. See `DESIGN-DECISIONS.md` D-0004.

## Required on every request

| Header             | Required                       | Rule                                                                               |
| ------------------ | ------------------------------ | ---------------------------------------------------------------------------------- |
| `x-cpf-usuario`    | always                         | 11-digit numeric CPF. Missing/malformed → **401**.                                 |
| `x-client-cert-cn` | when `AUTH_CERT_SIMULATION=on` | Simulated certificate Common Name; must be allowlisted. Missing/unknown → **401**. |

`x-cpf-usuario` is enforced regardless of any flag — it is part of the contract.
The certificate simulation is a second, toggleable factor.

## Certificate simulation

Controlled by env (`.env`):

- `AUTH_CERT_SIMULATION=on` (default) — `x-client-cert-cn` must match an
  allowlisted Common Name. The allowlist is, in order of precedence:
  1. rows in `mock.usuario_autorizado` (CN column), when the table is populated;
  2. otherwise the bootstrap dev list `AUTH_DEV_CERT_CNS`
     (default `senatran-dev-client`).
- `AUTH_CERT_SIMULATION=off` — only `x-cpf-usuario` is enforced; any/no
  `x-client-cert-cn` is accepted. Use for frictionless local integration.

## 401 response

Failures use the standard envelope with `401`:

```json
{
  "returnCode": 401,
  "message": "Não autorizado: falha na autenticação do certificado ou do CPF do usuário."
}
```

The exact `message` text is stable and may be asserted by consumers.

## Example (curl)

```bash
curl http://localhost:3000/v1/veiculos/placa/ABC1D23 \
  -H 'x-cpf-usuario: 12345678909' \
  -H 'x-client-cert-cn: senatran-dev-client'
```

## Notes for consumers

- The mock never validates a real certificate chain and must never be pointed at
  real SENATRAN endpoints.
- To force a deterministic `401` in tests, send the reserved CPF `00000000000` as
  `x-cpf-usuario` (see `scenarios.md`).
