-- SENATRAN mock — schema/table comments.
comment on schema senatran is 'Read-side WSDenatran domain entities + reference tables (dev-only mock).';
comment on schema mock     is 'Mock control plane: authorized users and forced scenario keys.';
comment on schema contract is 'Read views emitting the exact response JSON per endpoint (D-0010).';
comment on schema renach   is 'Transactional RENACH (driver-licensing exams).';
comment on schema renainf  is 'Transactional RENAINF (infraction lifecycle).';
comment on schema audit    is 'Shared audit trail + idempotency ledger (INV-IDEMP-001).';

comment on table senatran.veiculo is 'Vehicle rows: key columns + payload jsonb (exact Veiculo object).';
comment on table senatran.condutor is 'Driver rows: key columns + payload jsonb (exact Condutor object).';
comment on table senatran.infracao is 'Infraction rows: key columns + payload jsonb (exact Infracao object).';
comment on table mock.scenario_key is 'Reserved magic keys forcing 401/402/404/500 (scenarios.md).';
comment on table audit.evento is 'One row per transactional state transition, with SHA-256 payload hash.';
