import { Module } from '@nestjs/common';
import { ConsultaCsvController } from './consulta-csv.controller.js';

@Module({ controllers: [ConsultaCsvController] })
export class ConsultaCsvModule {}
