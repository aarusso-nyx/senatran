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
import { SneService } from './sne.service.js';
import { DtoValidationPipe } from '../../../shared/api/src/common/dto-validation.pipe.js';
import { NotificacaoDto, CancelamentoDto } from './dto/notificacao.dto.js';

/**
 * SNE national electronic-notification endpoints (7), ported to WSDenatran
 * conventions. Writes go through SneService (delivery lifecycle + idempotency +
 * audit); the dynamic status is set from the service result.
 */
@Controller('v1/sne')
export class SneController {
  constructor(@Inject(SneService) private readonly svc: SneService) {}

  private send(res: Response, r: { status: number; body: unknown }): unknown {
    res.status(r.status);
    return r.body;
  }

  @Get('adesoes/veiculos/:placa')
  adesaoVeiculo(@Param('placa') placa: string) {
    return this.svc.adesaoVeiculo(placa);
  }

  @Get('adesoes/cidadaos/:cpf')
  adesaoCidadao(@Param('cpf') cpf: string) {
    return this.svc.adesaoCidadao(cpf);
  }

  @Get('orgaos/:codigoOrgaoAutuador/adesao')
  adesaoOrgao(@Param('codigoOrgaoAutuador') codigo: string) {
    return this.svc.adesaoOrgao(codigo);
  }

  @Post('notificacoes/autuacao')
  async notificarAutuacao(
    @Body(new DtoValidationPipe(NotificacaoDto)) body: NotificacaoDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.notificarAutuacao({ ...body }, key));
  }

  @Post('notificacoes/penalidade')
  async notificarPenalidade(
    @Body(new DtoValidationPipe(NotificacaoDto)) body: NotificacaoDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.notificarPenalidade({ ...body }, key));
  }

  @Get('notificacoes/:protocolo')
  getNotificacao(@Param('protocolo') protocolo: string) {
    return this.svc.getNotificacao(protocolo);
  }

  @Post('notificacoes/:protocolo/cancelamento')
  async cancelar(
    @Param('protocolo') protocolo: string,
    @Body(new DtoValidationPipe(CancelamentoDto)) body: CancelamentoDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.cancelar(protocolo, { ...body }));
  }
}
