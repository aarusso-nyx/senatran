import { Controller, Get, Inject } from '@nestjs/common';
import { Database } from '../../../../domain/shared/api/src/database/database.js';

/**
 * Liveness/readiness probe. Not part of the WSDenatran contract — operational
 * only, and deliberately excluded from the `x-cpf-usuario` auth guard.
 */
@Controller('health')
export class HealthController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Get()
  async check(): Promise<{ status: string; db: 'up' | 'down' }> {
    let db: 'up' | 'down' = 'down';
    try {
      await this.db.query('select 1');
      db = 'up';
    } catch {
      db = 'down';
    }
    return { status: 'ok', db };
  }
}
