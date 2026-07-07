import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ReadService } from '../../../shared/api/src/common/read.service.js';

/**
 * WSDenatran `rouboFurto` endpoints. Thin: each method maps path params to a
 * prepared contract view via ReadService. No logic here (D-0003).
 */
@Controller('v1/rouboFurto')
export class RouboFurtoController {
  constructor(@Inject(ReadService) private readonly read: ReadService) {}

  @Get('emAberto/chassi/:chassi')
  emAbertoByChassi(@Param('chassi') chassi: string) {
    return this.read.one('v_roubo_furto_em_aberto_by_chassi', { chassi });
  }

  @Get('emAberto/placa/:placa')
  emAbertoByPlaca(@Param('placa') placa: string) {
    return this.read.one('v_roubo_furto_em_aberto_by_placa', { placa });
  }
}
