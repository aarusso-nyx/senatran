import { Module } from '@nestjs/common';
import { RenachController } from './renach.controller.js';
import { RenachService } from './renach.service.js';

@Module({ controllers: [RenachController], providers: [RenachService] })
export class RenachModule {}
