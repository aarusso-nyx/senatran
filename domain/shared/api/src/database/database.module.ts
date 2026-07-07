import { Global, Module } from '@nestjs/common';
import { Database, PgDatabase } from './database.js';
import { APP_CONFIG } from '../config/configuration.js';
import type { AppConfig } from '../config/configuration.js';

/**
 * Global database module. Provides the {@link Database} abstraction backed by a
 * `pg` pool built from the resolved {@link AppConfig}. Marked @Global so feature
 * modules can inject `Database` without re-importing.
 */
@Global()
@Module({
  providers: [
    {
      provide: Database,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Database =>
        new PgDatabase({
          connectionString: config.database.connectionString,
          ssl: config.database.ssl,
          queryTimeoutMs: config.database.queryTimeoutMs,
        }),
    },
  ],
  exports: [Database],
})
export class DatabaseModule {}
