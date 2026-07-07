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
import { RenainfService } from './renainf.service.js';

type Body = Record<string, unknown>;

/** RENAINF transactional endpoints (17), ported to WSDenatran conventions. */
@Controller('v1/renainf')
export class RenainfController {
  constructor(@Inject(RenainfService) private readonly svc: RenainfService) {}

  private send(res: Response, r: { status: number; body: unknown }): unknown {
    res.status(r.status);
    return r.body;
  }

  @Post('talonario/dispositivos')
  async dispositivo(
    @Body() b: Body,
    @Headers('idempotency-key') k: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.registrarDispositivo(b, k));
  }

  @Get('talonario/sincronizacao')
  sincronizar() {
    return this.svc.sincronizar();
  }

  @Post('talonario/faixasNumeracaoAit')
  async faixa(@Body() b: Body, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.svc.reservarFaixa(b));
  }

  @Post('autosInfracao/lotes')
  async lote(@Body() b: Body, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.svc.transmitirLote(b));
  }

  @Post('autosInfracao')
  async criarAit(
    @Body() b: Body,
    @Headers('idempotency-key') k: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.criarAit(b, k));
  }

  @Get('autosInfracao/:numeroAit')
  getAit(@Param('numeroAit') n: string) {
    return this.svc.getAit(n);
  }

  @Post('autosInfracao/:numeroAit/solicitacoesCancelamento')
  async cancelar(
    @Param('numeroAit') n: string,
    @Body() b: Body,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.solicitarCancelamento(n, b));
  }

  @Post('processosAdministrativos')
  async abrir(
    @Body() b: Body,
    @Headers('idempotency-key') k: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.abrirProcesso(b, k));
  }

  @Post('processosAdministrativos/:idProcesso/notificacoes/autuacao')
  async notAutuacao(
    @Param('idProcesso') id: string,
    @Body() b: Body,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.notificarAutuacao(id, b));
  }

  @Post('processosAdministrativos/:idProcesso/indicacoesCondutor')
  async indicar(
    @Param('idProcesso') id: string,
    @Body() b: Body,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.indicarCondutor(id, b));
  }

  @Post('processosAdministrativos/:idProcesso/defesasPrevias')
  async defesa(
    @Param('idProcesso') id: string,
    @Body() b: Body,
    @Headers('idempotency-key') k: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.protocolarDefesa(id, b, k));
  }

  @Post('processosAdministrativos/:idProcesso/penalidades')
  async penalidade(
    @Param('idProcesso') id: string,
    @Body() b: Body,
    @Headers('idempotency-key') k: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.imporPenalidade(id, b, k));
  }

  @Post('processosAdministrativos/:idProcesso/notificacoes/penalidade')
  async notPenalidade(
    @Param('idProcesso') id: string,
    @Body() b: Body,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.notificarPenalidade(id, b));
  }

  @Post('processosAdministrativos/:idProcesso/recursos')
  async recurso(
    @Param('idProcesso') id: string,
    @Body() b: Body,
    @Headers('idempotency-key') k: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.protocolarRecurso(id, b, k));
  }

  @Post('recursos/:idRecurso/julgamento')
  async julgar(
    @Param('idRecurso') id: string,
    @Body() b: Body,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.julgarRecurso(id, b));
  }

  @Get('processosAdministrativos/:idProcesso/debito')
  debito(@Param('idProcesso') id: string) {
    return this.svc.getDebito(id);
  }

  @Post('processosAdministrativos/:idProcesso/pagamentos')
  async pagamento(
    @Param('idProcesso') id: string,
    @Body() b: Body,
    @Headers('idempotency-key') k: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.registrarPagamento(id, b, k));
  }
}
