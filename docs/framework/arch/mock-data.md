# Mock data — SENATRAN mock

How the database is populated so the mock is useful to `pec`/`teat`: enough
coherent, format-valid, **deterministic** data to exercise every endpoint, plus
stable fixtures and the forced-scenario keys. (DESIGN-DECISIONS D-0006.)

Status: **design (P2)**.

## Generator

`tools/scripts/generate-seed.ts` (run via `pnpm seed:generate`) emits SQL into
`database/seed/` which `apply.sh --sample` loads after the DDL.

- **Deterministic.** A seeded PRNG (`mulberry32` with a fixed master seed constant)
  drives every random choice. `Math.random()` is never used. Re-running the
  generator produces **byte-identical** SQL. Fixtures are emitted first so their
  ids/keys are stable across reseeds.
- **Output**: one `NN-<entity>.sql` per entity under `database/seed/`, plus
  `database/seed/README.md` — the **fixture manifest** (generated) enumerating the
  stable identifiers and their key attributes for consumers to hardcode.
- Reference tables (`senatran.ref_*`) are **not** generated randomly — they are
  hand-authored DDL seeds (`database/ddl/8x-ref-*.sql`) with curated real DENATRAN
  codes; the generator only draws from them.

## Brazilian format rules (valid + verifiable)

| Field                              | Rule                                                              |
| ---------------------------------- | ----------------------------------------------------------------- |
| CPF                                | 11 digits, valid mod-11 check digits.                             |
| CNPJ                               | 14 digits, valid mod-11 check digits.                             |
| Placa (Mercosul)                   | `LLLNLNN` (e.g. `ABC1D23`).                                       |
| Placa (legacy)                     | `LLLNNNN` (e.g. `ABC1234`).                                       |
| Chassi                             | 17 chars, VIN alphabet (no I/O/Q).                                |
| RENAVAM                            | 11 digits with valid check digit.                                 |
| AIT / RENAINF / PGU / PID / RENACH | plausible fixed-length numeric strings.                           |
| Datas                              | ISO `timestamptz`; plausible ranges (nascimento 1950–2005, etc.). |

Generating valid check digits means consumer-side validators (which `pec`/`teat`
apply) accept the mock's data.

## Volumes (target)

| Entity                                                                               | Rows     | Notes                                                                                                                      |
| ------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `veiculo`                                                                            | ~500     | ~70% Mercosul / ~30% legacy plates; owners split CPF/CNPJ; indicators mostly `false`, a documented minority `true`.        |
| `condutor`                                                                           | ~300     | a subset are also vehicle owners; each has 0–3 `condutor_ocorrencia`.                                                      |
| `infracao`                                                                           | ~1000    | each linked to a real `veiculo` (placa/renavam) and often a `condutor` (cpf/registroCnh); 0–2 ocorrências/pagamentos each. |
| `restricao_judicial`                                                                 | ~60      | on a subset of vehicles, with 1–2 processos.                                                                               |
| `roubo_furto_ocorrencia`                                                             | ~40      | on a subset (drives the roubo/furto indicators).                                                                           |
| `recall`                                                                             | ~50      | on a subset (drives recall indicators).                                                                                    |
| `comunicacao_venda` / `endereco_possuidor` / `multa_interestadual` / `csv_seguranca` | ~80 each | keyed to existing vehicles/owners.                                                                                         |
| `condutor_imagem`                                                                    | ~120     | for a subset of drivers (imagens/retrato/validacao).                                                                       |

## Coherence rules (enforced by the generator)

- Every `infracao.placa`/`codigo_renavam` references an existing `veiculo`.
- Every `infracao.numero_registro_cnh`/`cpf` (when present) references an existing
  `condutor`.
- Indicator columns on `veiculo` agree with the child rows: `ind_roubo_furto=true`
  iff a `roubo_furto_ocorrencia` exists; `ind_recall*` iff a `recall` exists; etc.
- `codigo_*` values exist in the matching `ref_*` table (so descriptions resolve).
- Owner identity (`numero_identificacao_proprietario` + `codigo_tipo_proprietario`)
  is a real CPF/CNPJ; the `veiculos/proprietario/{cpf|cnpj}` lookups return the
  vehicles that owner holds.

## Known fixtures (stable, documented)

Emitted first, never changing across reseeds; consumers may hardcode them. The
authoritative values land in the generated `database/seed/README.md`; the reserved
shapes are:

| Fixture              | Value        | Guarantees                                                        |
| -------------------- | ------------ | ----------------------------------------------------------------- |
| Placa Mercosul       | `ABC1D23`    | full vehicle, CPF owner, all indicators `false`, has ≥1 infração. |
| Placa legacy         | `ABC1234`    | legacy-format vehicle.                                            |
| Placa c/ indicadores | `IND1I01`    | roubo/furto + alarme + restrição judicial `true`.                 |
| CPF condutor         | _(manifest)_ | driver with CNH válida + 1 infração + 1 ocorrência.               |
| CNPJ proprietário    | _(manifest)_ | company owning ≥2 vehicles.                                       |
| Chassi / RENAVAM     | _(manifest)_ | linked to `ABC1D23`.                                              |

## Control-plane seeds

- **`mock.usuario_autorizado`** — dev users: at least
  `{ cpf: 12345678909, cert_cn: 'senatran-dev-client', ativo: true }`.
- **`mock.scenario_key`** — the reserved sentinels from `scenarios.md`
  (401 `cpf_usuario=00000000000`; 402/500 for placa/chassi/cpf/cnpj/renavam). The
  generator asserts none of these values collide with generated data.

## Determinism guarantee

`pnpm seed:generate` is idempotent and reviewable: the emitted SQL is committed, so
a diff shows exactly what changed. CI can regenerate and assert no diff
(`git diff --exit-code database/seed`) to prevent drift.
