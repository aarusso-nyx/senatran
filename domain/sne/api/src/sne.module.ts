import { Module } from '@nestjs/common';
import { SneController } from './sne.controller.js';
import { SneService } from './sne.service.js';

@Module({ controllers: [SneController], providers: [SneService] })
export class SneModule {}
