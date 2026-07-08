import { Module } from '@nestjs/common';
import { RenaestController } from './renaest.controller.js';
import { RenaestService } from './renaest.service.js';

@Module({ controllers: [RenaestController], providers: [RenaestService] })
export class RenaestModule {}
