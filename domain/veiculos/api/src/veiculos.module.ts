import { Module } from '@nestjs/common';
import { VeiculosController } from './veiculos.controller.js';

@Module({ controllers: [VeiculosController] })
export class VeiculosModule {}
