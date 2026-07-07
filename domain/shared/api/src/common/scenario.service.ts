import { Inject, Injectable } from '@nestjs/common';
import { Database } from '../database/database.js';
import { APP_CONFIG, type AppConfig } from '../config/configuration.js';

/**
 * Resolves the mock control plane: forced scenario keys (scenarios.md) and the
 * certificate-simulation allowlist (auth.md). Backed by the `mock` schema.
 */
@Injectable()
export class ScenarioService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Forced status for a reserved (kind, value), or null. */
  async forced(
    kind: string,
    value: string,
  ): Promise<{ status: number; message: string } | null> {
    const r = await this.db.query<{ force_status: number; message: string }>(
      'select force_status, message from mock.scenario_key where kind = $1 and key_value = $2',
      [kind, value],
    );
    return r.rows[0]
      ? { status: r.rows[0].force_status, message: r.rows[0].message }
      : null;
  }

  /** Whether a simulated certificate CN is allowlisted. */
  async certAllowed(certCn: string | undefined): Promise<boolean> {
    if (!this.config.auth.certSimulation) return true;
    if (!certCn) return false;
    if (this.config.auth.devCertCns.includes(certCn)) return true;
    const r = await this.db.query<{ n: number }>(
      'select count(*)::int as n from mock.usuario_autorizado where cert_cn = $1 and ativo',
      [certCn],
    );
    return (r.rows[0]?.n ?? 0) > 0;
  }
}
