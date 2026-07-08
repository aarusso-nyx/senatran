import { Module } from '@nestjs/common';
import { DetranController } from './detran.controller.js';
import { DetranService } from './detran.service.js';

@Module({ controllers: [DetranController], providers: [DetranService] })
export class DetranModule {}
