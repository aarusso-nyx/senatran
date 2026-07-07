import { Module } from '@nestjs/common';
import { InfracoesController } from './infracoes.controller.js';

@Module({ controllers: [InfracoesController] })
export class InfracoesModule {}
