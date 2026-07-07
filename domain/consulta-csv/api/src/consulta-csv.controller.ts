import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ReadService } from '../../../shared/api/src/common/read.service.js';

/**
 * WSDenatran `ConsultaCSV` endpoints. Thin: each method maps path params to a
 * prepared contract view via ReadService. No logic here (D-0003).
 */
@Controller('v1/ConsultaCSV')
export class ConsultaCsvController {
  constructor(@Inject(ReadService) private readonly read: ReadService) {}

  @Get('chassi/:chassi')
  byChassi(@Param('chassi') chassi: string) {
    return this.read.one('v_consulta_csv_by_chassi', { chassi });
  }

  @Get('placa/:placa')
  byPlaca(@Param('placa') placa: string) {
    return this.read.one('v_consulta_csv_by_placa', { placa });
  }
}
