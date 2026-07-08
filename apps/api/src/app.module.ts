import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '../../../domain/shared/api/src/config/config.module.js';
import { DatabaseModule } from '../../../domain/shared/api/src/database/database.module.js';
import { SharedModule } from '../../../domain/shared/api/src/common/shared.module.js';
import { CpfUsuarioGuard } from '../../../domain/shared/api/src/common/cpf-usuario.guard.js';
import { WsdenatranExceptionFilter } from '../../../domain/shared/api/src/common/wsdenatran-exception.filter.js';
import { HealthController } from './health/health.controller.js';
import { VeiculosModule } from '../../../domain/veiculos/api/src/veiculos.module.js';
import { CondutoresModule } from '../../../domain/condutores/api/src/condutores.module.js';
import { InfracoesModule } from '../../../domain/infracoes/api/src/infracoes.module.js';
import { IndicadoresModule } from '../../../domain/indicadores/api/src/indicadores.module.js';
import { RestricoesJudiciaisModule } from '../../../domain/restricoes-judiciais/api/src/restricoes-judiciais.module.js';
import { RouboFurtoModule } from '../../../domain/roubo-furto/api/src/roubo-furto.module.js';
import { ConsultaCsvModule } from '../../../domain/consulta-csv/api/src/consulta-csv.module.js';
import { AutorizacoesModule } from '../../../domain/autorizacoes/api/src/autorizacoes.module.js';
import { RenachModule } from '../../../domain/renach/api/src/renach.module.js';
import { RenainfModule } from '../../../domain/renainf/api/src/renainf.module.js';
import { RenaestModule } from '../../../domain/renaest/api/src/renaest.module.js';
import { SneModule } from '../../../domain/sne/api/src/sne.module.js';
import { CdtModule } from '../../../domain/cdt/api/src/cdt.module.js';
import { DetranModule } from '../../../domain/detran/api/src/detran.module.js';

/**
 * Root module. Global config + database + shared services, the WSDenatran auth
 * guard and error filter, and the feature modules (read + transactional).
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    SharedModule,
    // Read (WSDenatran) feature modules:
    VeiculosModule,
    CondutoresModule,
    InfracoesModule,
    IndicadoresModule,
    RestricoesJudiciaisModule,
    RouboFurtoModule,
    ConsultaCsvModule,
    AutorizacoesModule,
    // Transactional (RENACH/RENAINF) modules:
    RenachModule,
    RenainfModule,
    // National-extension transactional modules (RENAEST/SNE/CDT/DETRAN bridge):
    RenaestModule,
    SneModule,
    CdtModule,
    DetranModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: CpfUsuarioGuard },
    { provide: APP_FILTER, useClass: WsdenatranExceptionFilter },
  ],
})
export class AppModule {}
