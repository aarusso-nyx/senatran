import { Module } from '@nestjs/common';
import { AutorizacoesController } from './autorizacoes.controller.js';

@Module({ controllers: [AutorizacoesController] })
export class AutorizacoesModule {}
