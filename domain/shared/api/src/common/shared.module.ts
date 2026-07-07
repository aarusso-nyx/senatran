import { Global, Module } from '@nestjs/common';
import { ScenarioService } from './scenario.service.js';
import { ReadService } from './read.service.js';
import { TransactionSupport } from './transaction-support.service.js';

/**
 * Global shared module: the mock control plane (ScenarioService), the read seam
 * (ReadService) for WSDenatran endpoints, and idempotency/audit support
 * (TransactionSupport) for the transactional endpoints.
 */
@Global()
@Module({
  providers: [ScenarioService, ReadService, TransactionSupport],
  exports: [ScenarioService, ReadService, TransactionSupport],
})
export class SharedModule {}
