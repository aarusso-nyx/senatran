import { Controller, Get, Inject } from '@nestjs/common';
import { ReadService } from '../../../shared/api/src/common/read.service.js';

/**
 * WSDenatran `autorizacoesAlteracaoVeiculo` endpoints. Thin: each method maps to
 * a prepared contract view via ReadService. No logic here (D-0003).
 */
@Controller('v1/autorizacoesAlteracaoVeiculo')
export class AutorizacoesController {
  constructor(@Inject(ReadService) private readonly read: ReadService) {}

  @Get('alteracoesPermitidas')
  alteracoesPermitidas() {
    return this.read.one('v_alteracoes_permitidas');
  }
}
