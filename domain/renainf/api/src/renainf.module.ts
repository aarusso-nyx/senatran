import { Module } from '@nestjs/common';
import { RenainfController } from './renainf.controller.js';
import { RenainfService } from './renainf.service.js';

@Module({ controllers: [RenainfController], providers: [RenainfService] })
export class RenainfModule {}
