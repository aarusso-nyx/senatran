import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CdtService } from './cdt.service.js';
import { DtoValidationPipe } from '../../../shared/api/src/common/dto-validation.pipe.js';
import { ReconhecimentoDto } from './dto/reconhecimento.dto.js';

/**
 * CDT citizen-channel projection endpoints (6), ported to WSDenatran
 * conventions. All reads except `reconhecimento`, which is a write (audited).
 */
@Controller('v1/cdt')
export class CdtController {
  constructor(@Inject(CdtService) private readonly svc: CdtService) {}

  private send(res: Response, r: { status: number; body: unknown }): unknown {
    res.status(r.status);
    return r.body;
  }

  @Get('cidadaos/:cpf/notificacoes')
  notificacoes(@Param('cpf') cpf: string) {
    return this.svc.notificacoes(cpf);
  }

  @Get('cidadaos/:cpf/infracoes')
  infracoes(@Param('cpf') cpf: string) {
    return this.svc.infracoes(cpf);
  }

  @Get('cidadaos/:cpf/veiculos')
  veiculos(@Param('cpf') cpf: string) {
    return this.svc.veiculos(cpf);
  }

  @Get('cidadaos/:cpf/cnh')
  cnh(@Param('cpf') cpf: string) {
    return this.svc.cnh(cpf);
  }

  @Get('infracoes/:numeroAit/pagamento')
  pagamento(@Param('numeroAit') numeroAit: string) {
    return this.svc.pagamento(numeroAit);
  }

  @Post('infracoes/:numeroAit/reconhecimento')
  async reconhecer(
    @Param('numeroAit') numeroAit: string,
    @Body(new DtoValidationPipe(ReconhecimentoDto)) body: ReconhecimentoDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.svc.reconhecer(numeroAit, { ...body }));
  }
}
