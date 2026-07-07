import { Module } from '@nestjs/common';
import { IndicadoresController } from './indicadores.controller.js';

@Module({ controllers: [IndicadoresController] })
export class IndicadoresModule {}
