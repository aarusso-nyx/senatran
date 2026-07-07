import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ReadService } from '../../../shared/api/src/common/read.service.js';

/**
 * WSDenatran `restricoesJudiciaisAtivas` endpoints. Thin: each method maps path
 * params to a prepared contract view via ReadService. No logic here (D-0003).
 */
@Controller('v1/restricoesJudiciaisAtivas')
export class RestricoesJudiciaisController {
  constructor(@Inject(ReadService) private readonly read: ReadService) {}

  @Get('placa/:placa')
  byPlaca(@Param('placa') placa: string) {
    return this.read.one('v_restricoes_judiciais_ativas_by_placa', { placa });
  }

  @Get('placa/:placa/renavam/:renavam')
  byPlacaRenavam(
    @Param('placa') placa: string,
    @Param('renavam') renavam: string,
  ) {
    return this.read.one('v_restricoes_judiciais_ativas_by_placa_and_renavam', {
      renavam,
      placa,
    });
  }
}
