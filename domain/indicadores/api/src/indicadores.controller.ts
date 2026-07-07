import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ReadService } from '../../../shared/api/src/common/read.service.js';

/**
 * WSDenatran `indicadores` endpoints. Thin: each method maps path params to a
 * prepared contract view via ReadService. No logic here (D-0003).
 */
@Controller('v1/indicadores')
export class IndicadoresController {
  constructor(@Inject(ReadService) private readonly read: ReadService) {}

  @Get('alarme/chassi/:chassi')
  alarmeByChassi(@Param('chassi') chassi: string) {
    return this.read.one('v_indicador_alarme_by_chassi', { chassi });
  }

  @Get('alarme/placa/:placa')
  alarmeByPlaca(@Param('placa') placa: string) {
    return this.read.one('v_indicador_alarme_by_placa', { placa });
  }

  @Get('restricaoJudicial/chassi/:chassi')
  restricaoJudicialByChassi(@Param('chassi') chassi: string) {
    return this.read.one('v_indicador_restricao_judicial_by_chassi', {
      chassi,
    });
  }

  @Get('restricaoJudicial/placa/:placa')
  restricaoJudicialByPlaca(@Param('placa') placa: string) {
    return this.read.one('v_indicador_restricao_judicial_by_placa', { placa });
  }

  @Get('rouboFurto/chassi/:chassi')
  rouboFurtoByChassi(@Param('chassi') chassi: string) {
    return this.read.one('v_indicador_roubo_furto_by_chassi', { chassi });
  }

  @Get('rouboFurto/placa/:placa')
  rouboFurtoByPlaca(@Param('placa') placa: string) {
    return this.read.one('v_indicador_roubo_furto_by_placa', { placa });
  }

  @Get('sinistro/chassi/:chassi')
  sinistroByChassi(@Param('chassi') chassi: string) {
    return this.read.one('v_indicador_sinistro_by_chassi', { chassi });
  }

  @Get('sinistro/placa/:placa')
  sinistroByPlaca(@Param('placa') placa: string) {
    return this.read.one('v_indicador_sinistro_by_placa', { placa });
  }
}
