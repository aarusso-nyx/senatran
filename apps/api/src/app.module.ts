import { Module } from '@nestjs/common';
import { ConfigModule } from '../../../domain/shared/api/src/config/config.module.js';
import { DatabaseModule } from '../../../domain/shared/api/src/database/database.module.js';
import { HealthController } from './health/health.controller.js';

/**
 * Root application module.
 *
 * Composes the global config + database providers and the feature modules that
 * implement the WSDenatran contract. Feature modules are added in P4; each is a
 * thin controller + service pair reading a prepared `contract.*` view.
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    // WSDenatran feature modules (P4):
    // VeiculosModule, CondutoresModule, InfracoesModule, IndicadoresModule,
    // RestricoesJudiciaisModule, RouboFurtoModule, ConsultaCsvModule,
    // AutorizacoesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
