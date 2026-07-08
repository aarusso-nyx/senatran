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
import { RenaestService } from './renaest.service.js';
import { DtoValidationPipe } from '../../../shared/api/src/common/dto-validation.pipe.js';
import {
  SinistroDto,
  SinistroLoteDto,
  RetificacaoSinistroDto,
} from './dto/sinistro.dto.js';

/**
 * RENAEST national crash/sinister endpoints (6), ported to WSDenatran
 * conventions. Writes go through RenaestService (record lifecycle + idempotency
 * + audit); the dynamic status (201 created / 200 idempotent replay / 202
 * async) is set from the service result.
 */
@Controller('v1/renaest')
export class RenaestController {
  constructor(@Inject(RenaestService) private readonly svc: RenaestService) {}

  private send(res: Response, r: { status: number; body: unknown }): unknown {
    res.status(r.status);
    return r.body;
  }

  @Post('sinistros')
  async submeter(
    @Body(new DtoValidationPipe(SinistroDto)) body: SinistroDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.submeterSinistro({ ...body }, key));
  }

  @Post('sinistros/lotes')
  async submeterLote(
    @Body(new DtoValidationPipe(SinistroLoteDto)) body: SinistroLoteDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.submeterLote({ ...body }, key));
  }

  @Get('sinistros/:idSinistro')
  getSinistro(@Param('idSinistro') id: string) {
    return this.svc.getSinistro(id);
  }

  @Get('protocolos/:protocolo')
  getProtocolo(@Param('protocolo') protocolo: string) {
    return this.svc.getProtocolo(protocolo);
  }

  @Post('sinistros/:idSinistro/complementos')
  async complementar(
    @Param('idSinistro') id: string,
    @Body(new DtoValidationPipe(RetificacaoSinistroDto))
    body: RetificacaoSinistroDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.complementar(id, { ...body }));
  }

  @Post('sinistros/:idSinistro/correcoes')
  async corrigir(
    @Param('idSinistro') id: string,
    @Body(new DtoValidationPipe(RetificacaoSinistroDto))
    body: RetificacaoSinistroDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.corrigir(id, { ...body }));
  }
}
