-- SENATRAN mock — schemas.
--   senatran : read-side domain entities (WSDenatran) + reference tables
--   mock     : mock control plane (authorized users, forced scenario keys)
--   contract : read views that emit the exact response JSON
--   renach   : transactional driver-licensing (RENACH)
--   renainf  : transactional infraction lifecycle (RENAINF)
--   audit    : shared audit + idempotency
create schema if not exists senatran;
create schema if not exists mock;
create schema if not exists contract;
create schema if not exists renach;
create schema if not exists renainf;
create schema if not exists audit;
