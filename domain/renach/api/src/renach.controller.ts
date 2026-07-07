import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RenachService } from './renach.service.js';

type Body = Record<string, unknown>;

/**
 * RENACH transactional endpoints (13), ported to WSDenatran conventions. Writes
 * go through RenachService (state machine + idempotency + audit); the dynamic
 * status (201 created / 200 idempotent replay / 202 async) is set from the
 * service result.
 */
@Controller('v1/renach')
export class RenachController {
  constructor(@Inject(RenachService) private readonly svc: RenachService) {}

  private send(res: Response, r: { status: number; body: unknown }): unknown {
    res.status(r.status);
    return r.body;
  }

  @Get('processos/:numeroRenach')
  getProcesso(@Param('numeroRenach') n: string) {
    return this.svc.getProcesso(n);
  }

  @Post('processos/:numeroRenach/elegibilidadeExame')
  elegibilidade(@Param('numeroRenach') n: string) {
    return this.svc.elegibilidade(n);
  }

  @Get('clinicasCredenciadas')
  clinicas() {
    return this.svc.listClinicas();
  }

  @Get('profissionaisCredenciados')
  profissionais() {
    return this.svc.listProfissionais();
  }

  @Post('processos/:numeroRenach/agendamentos')
  async criarAgendamento(
    @Param('numeroRenach') n: string,
    @Body() body: Body,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.criarAgendamento(n, body, key));
  }

  @Patch('agendamentos/:idAgendamento')
  patchAgendamento(@Param('idAgendamento') id: string, @Body() body: Body) {
    return this.svc.patchAgendamento(id, body);
  }

  @Post('agendamentos/:idAgendamento/checkin')
  checkin(@Param('idAgendamento') id: string) {
    return this.svc.checkin(id);
  }

  @Post('processos/:numeroRenach/examesMedicos')
  async exameMedico(
    @Param('numeroRenach') n: string,
    @Body() body: Body,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(
      res,
      await this.svc.registrarExame(n, 'MEDICO', body, key),
    );
  }

  @Post('processos/:numeroRenach/avaliacoesPsicologicas')
  async avaliacaoPsicologica(
    @Param('numeroRenach') n: string,
    @Body() body: Body,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(
      res,
      await this.svc.registrarExame(n, 'PSICOLOGICO', body, key),
    );
  }

  @Get('processos/:numeroRenach/exames')
  exames(@Param('numeroRenach') n: string) {
    return this.svc.listExames(n);
  }

  @Post('exames/:idExame/retificacoes')
  async retificar(
    @Param('idExame') id: string,
    @Body() body: Body,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.retificarExame(id, body));
  }

  @Post('processos/:numeroRenach/encaminhamentosJunta')
  async encaminharJunta(
    @Param('numeroRenach') n: string,
    @Body() body: Body,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.encaminharJunta(n, body));
  }

  @Post('processos/:numeroRenach/pareceresJunta')
  async parecerJunta(
    @Param('numeroRenach') n: string,
    @Body() body: Body,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.registrarParecerJunta(n, body));
  }
}
