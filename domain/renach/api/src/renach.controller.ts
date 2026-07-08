import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RenachService } from './renach.service.js';
import { DtoValidationPipe } from '../../../shared/api/src/common/dto-validation.pipe.js';
import { ExameMedicoDto } from './dto/exame-medico.dto.js';
import { AvaliacaoPsicologicaDto } from './dto/avaliacao-psicologica.dto.js';
import { AberturaProcessoRenachDto } from './dto/abertura-processo.dto.js';

type Body = Record<string, unknown>;

/**
 * RENACH transactional endpoints (14), ported to WSDenatran conventions. Writes
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

  @Post('processos')
  async abrirProcesso(
    @Body(new DtoValidationPipe(AberturaProcessoRenachDto))
    body: AberturaProcessoRenachDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.abrirProcesso({ ...body }, key));
  }

  @Get('processos')
  consultarProcessos(
    @Query('cpf') cpf: string,
    @Query('tipoProcesso') tipoProcesso?: string,
  ) {
    return this.svc.consultarProcessos(cpf, tipoProcesso);
  }

  @Get('processos/:numeroRenach')
  getProcesso(@Param('numeroRenach') n: string) {
    return this.svc.getProcesso(n);
  }

  @Post('processos/:numeroRenach/elegibilidadeExame')
  @HttpCode(200) // read-only check; contract declares 200 (not Nest's POST 201)
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
    @Body(new DtoValidationPipe(ExameMedicoDto)) body: ExameMedicoDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(
      res,
      await this.svc.registrarExame(n, 'MEDICO', { ...body }, key),
    );
  }

  @Post('processos/:numeroRenach/avaliacoesPsicologicas')
  async avaliacaoPsicologica(
    @Param('numeroRenach') n: string,
    @Body(new DtoValidationPipe(AvaliacaoPsicologicaDto))
    body: AvaliacaoPsicologicaDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(
      res,
      await this.svc.registrarExame(n, 'PSICOLOGICO', { ...body }, key),
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
