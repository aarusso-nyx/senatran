import { Module } from '@nestjs/common';
import { RestricoesJudiciaisController } from './restricoes-judiciais.controller.js';

@Module({ controllers: [RestricoesJudiciaisController] })
export class RestricoesJudiciaisModule {}
