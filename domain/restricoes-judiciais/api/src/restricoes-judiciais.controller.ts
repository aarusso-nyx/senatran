import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ReadService } from '../../../shared/api/src/common/read.service.js';

/**
 * WSDenatran `restricoesJudiciaisAtivas` endpoints — cursor-paginated over the
 * base table via ReadService.list. No logic here (D-0003).
 */
@Controller('v1/restricoesJudiciaisAtivas')
export class RestricoesJudiciaisController {
  constructor(@Inject(ReadService) private readonly read: ReadService) {}

  @Get('placa/:placa')
  byPlaca(
    @Param('placa') placa: string,
    @Query('idUltimoRegistro') cursor?: string,
  ) {
    return this.read.list('restricao_judicial_processo', { placa }, cursor);
  }

  @Get('placa/:placa/renavam/:renavam')
  byPlacaRenavam(
    @Param('placa') placa: string,
    @Param('renavam') renavam: string,
    @Query('idUltimoRegistro') cursor?: string,
  ) {
    return this.read.list(
      'restricao_judicial_processo',
      { renavam, placa },
      cursor,
    );
  }
}
