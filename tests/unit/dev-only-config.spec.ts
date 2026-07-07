import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../domain/shared/api/src/config/configuration.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('dev-only configuration (INV-SEC-001)', () => {
  it('defaults to a local database with no external host', () => {
    const cfg = loadConfig({});
    expect(cfg.database.connectionString).toContain('localhost');
    expect(cfg.database.connectionString).toContain('/senatran');
    expect(cfg.database.ssl).toBe(false);
  });

  it('.env.example points at no real SENATRAN/SERPRO endpoint', () => {
    const env = readFileSync(resolve(root, '.env.example'), 'utf8');
    expect(env).not.toMatch(/serpro\.gov\.br/i);
    expect(env).not.toMatch(/denatran\.serpro/i);
    expect(env).toMatch(/localhost/);
  });

  it('cert simulation defaults on with a dev CN', () => {
    const cfg = loadConfig({});
    expect(cfg.auth.certSimulation).toBe(true);
    expect(cfg.auth.devCertCns).toContain('senatran-dev-client');
  });
});
