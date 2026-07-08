import { Module } from '@nestjs/common';
import { CdtController } from './cdt.controller.js';
import { CdtService } from './cdt.service.js';

@Module({ controllers: [CdtController], providers: [CdtService] })
export class CdtModule {}
