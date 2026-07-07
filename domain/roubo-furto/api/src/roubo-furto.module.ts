import { Module } from '@nestjs/common';
import { RouboFurtoController } from './roubo-furto.controller.js';

@Module({ controllers: [RouboFurtoController] })
export class RouboFurtoModule {}
