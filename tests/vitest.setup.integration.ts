/**
 * Integration/e2e-tier setup. Extends the unit setup and points at the real
 * local Postgres `senatran` database (Postgres.app defaults). These tiers assume
 * `pnpm db:reset` has been run.
 */
import './vitest.setup.js';

const setIfAbsent = (k: string, v: string): void => {
  if (process.env[k] === undefined) process.env[k] = v;
};

// Real local database for integration/e2e (override the unit stub URL).
process.env.DATABASE_URL =
  process.env.SENATRAN_TEST_DATABASE_URL ??
  'postgres://postgres@localhost:5432/senatran';
setIfAbsent('DB_HOST', 'localhost');
setIfAbsent('DB_PORT', '5432');
setIfAbsent('DB_USER', 'postgres');
setIfAbsent('DB_NAME', 'senatran');
