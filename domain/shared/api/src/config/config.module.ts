import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from './configuration.js';

/**
 * Global configuration module. Resolves the {@link AppConfig} once from the
 * process environment and exposes it under the {@link APP_CONFIG} token.
 */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
