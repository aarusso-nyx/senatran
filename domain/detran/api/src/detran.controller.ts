import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { DetranService } from './detran.service.js';
import { DtoValidationPipe } from '../../../shared/api/src/common/dto-validation.pipe.js';
import { BridgeRequestDto } from './dto/bridge.dto.js';

/**
 * State-DETRAN national-base bridge endpoints (6), ported to WSDenatran
 * conventions. Writes go through DetranService (profile/layout validation +
 * idempotency + audit); the dynamic status is set from the service result.
 */
@Controller('v1/detrans')
export class DetranController {
  constructor(@Inject(DetranService) private readonly svc: DetranService) {}

  private send(res: Response, r: { status: number; body: unknown }): unknown {
    res.status(r.status);
    return r.body;
  }

  @Post(':uf/renavam/consultasVeiculo')
  async consultarVeiculo(
    @Param('uf') uf: string,
    @Body(new DtoValidationPipe(BridgeRequestDto)) body: BridgeRequestDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(
      res,
      await this.svc.consultarVeiculo(uf, { ...body }, key),
    );
  }

  @Post(':uf/renach/consultasCondutor')
  async consultarCondutor(
    @Param('uf') uf: string,
    @Body(new DtoValidationPipe(BridgeRequestDto)) body: BridgeRequestDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(
      res,
      await this.svc.consultarCondutor(uf, { ...body }, key),
    );
  }

  @Post(':uf/renainf/autosInfracao')
  async enviarAit(
    @Param('uf') uf: string,
    @Body(new DtoValidationPipe(BridgeRequestDto)) body: BridgeRequestDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.enviarAit(uf, { ...body }, key));
  }

  @Get(':uf/renainf/autosInfracao/:numeroAit')
  consultarAit(@Param('uf') uf: string, @Param('numeroAit') numeroAit: string) {
    return this.svc.consultarAit(uf, numeroAit);
  }

  @Post(':uf/renaest/sinistros')
  async enviarSinistro(
    @Param('uf') uf: string,
    @Body(new DtoValidationPipe(BridgeRequestDto)) body: BridgeRequestDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.enviarSinistro(uf, { ...body }, key));
  }

  @Post(':uf/sne/notificacoes')
  async enviarNotificacao(
    @Param('uf') uf: string,
    @Body(new DtoValidationPipe(BridgeRequestDto)) body: BridgeRequestDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(
      res,
      await this.svc.enviarNotificacao(uf, { ...body }, key),
    );
  }
}
