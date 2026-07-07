import { describe, expect, it } from 'vitest';
import { ScenarioService } from './scenario.service.js';
import type { AppConfig } from '../config/configuration.js';
import { DatabaseStub } from '../../../../../tests/utils/database.stub.js';

const cfg = (
  certSimulation: boolean,
  devCertCns: string[] = ['senatran-dev-client'],
): AppConfig => ({ auth: { certSimulation, devCertCns } }) as AppConfig;

describe('ScenarioService', () => {
  it('forced() returns the row for a reserved key', async () => {
    const db = new DatabaseStub();
    db.handler = () => ({ rows: [{ force_status: 402, message: 'X' }] });
    const s = new ScenarioService(db, cfg(true));
    expect(await s.forced('placa', 'ERR2A02')).toEqual({
      status: 402,
      message: 'X',
    });
  });

  it('forced() returns null when no reserved key matches', async () => {
    const db = new DatabaseStub();
    const s = new ScenarioService(db, cfg(true));
    expect(await s.forced('placa', 'ABC1D23')).toBeNull();
  });

  it('certAllowed() is always true when simulation is off', async () => {
    const s = new ScenarioService(new DatabaseStub(), cfg(false));
    expect(await s.certAllowed(undefined)).toBe(true);
  });

  it('certAllowed() rejects a missing CN when simulation is on', async () => {
    const s = new ScenarioService(new DatabaseStub(), cfg(true));
    expect(await s.certAllowed(undefined)).toBe(false);
  });

  it('certAllowed() accepts a dev-list CN without a DB hit', async () => {
    const db = new DatabaseStub();
    const s = new ScenarioService(db, cfg(true));
    expect(await s.certAllowed('senatran-dev-client')).toBe(true);
    expect(db.calls).toHaveLength(0);
  });

  it('certAllowed() falls back to the usuario_autorizado allowlist', async () => {
    const db = new DatabaseStub();
    db.handler = () => ({ rows: [{ n: 1 }] });
    const s = new ScenarioService(db, cfg(true, []));
    expect(await s.certAllowed('some-cn')).toBe(true);
    db.handler = () => ({ rows: [{ n: 0 }] });
    expect(await s.certAllowed('other-cn')).toBe(false);
  });
});
