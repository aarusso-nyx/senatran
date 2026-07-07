import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ReadService } from '../../../shared/api/src/common/read.service.js';

/**
 * WSDenatran `rouboFurto` endpoints — cursor-paginated over the base table via
 * ReadService.list. No logic here (D-0003).
 */
@Controller('v1/rouboFurto')
export class RouboFurtoController {
  constructor(@Inject(ReadService) private readonly read: ReadService) {}

  @Get('emAberto/chassi/:chassi')
  emAbertoByChassi(
    @Param('chassi') chassi: string,
    @Query('idUltimoRegistro') cursor?: string,
  ) {
    return this.read.list('roubo_furto_ocorrencia', { chassi }, cursor);
  }

  @Get('emAberto/placa/:placa')
  emAbertoByPlaca(
    @Param('placa') placa: string,
    @Query('idUltimoRegistro') cursor?: string,
  ) {
    return this.read.list('roubo_furto_ocorrencia', { placa }, cursor);
  }
}
