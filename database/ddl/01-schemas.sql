-- SENATRAN mock — schemas.
--   senatran : read-side domain entities (WSDenatran) + reference tables
--   mock     : mock control plane (authorized users, forced scenario keys)
--   contract : read views that emit the exact response JSON
--   renach   : transactional driver-licensing (RENACH)
--   renainf  : transactional infraction lifecycle (RENAINF)
--   renaest  : transactional crash/sinister national base (RENAEST)
--   sne      : electronic notification base (SNE)
--   cdt      : citizen-channel projection (CDT)
--   detran   : state-DETRAN national-base bridge
--   audit    : shared audit + idempotency
create schema if not exists senatran;
create schema if not exists mock;
create schema if not exists contract;
create schema if not exists renach;
create schema if not exists renainf;
create schema if not exists renaest;
create schema if not exists sne;
create schema if not exists cdt;
create schema if not exists detran;
create schema if not exists audit;
