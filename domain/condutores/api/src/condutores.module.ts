import { Module } from '@nestjs/common';
import { CondutoresController } from './condutores.controller.js';

@Module({ controllers: [CondutoresController] })
export class CondutoresModule {}
