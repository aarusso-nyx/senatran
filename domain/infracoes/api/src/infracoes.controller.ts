import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ReadService } from '../../../shared/api/src/common/read.service.js';

/**
 * WSDenatran `infracoes` endpoints. Thin: list endpoints paginate over the base
 * table via ReadService.list (honoring idUltimoRegistro); ocorrencias/pagamentos
 * (no cursor in their schema) read a prepared view. No logic here (D-0003).
 */
@Controller('v1/infracoes')
export class InfracoesController {
  constructor(@Inject(ReadService) private readonly read: ReadService) {}

  @Get('ait/:autoInfracao/orgaoAutuador/:orgao/infracao/:codigoInfracao')
  byAit(
    @Param('autoInfracao') autoInfracao: string,
    @Param('orgao') orgao: string,
    @Param('codigoInfracao') codigoInfracao: string,
    @Query('idUltimoRegistro') cursor?: string,
  ) {
    return this.read.list(
      'infracao',
      {
        codigo_orgao_autuador: orgao,
        auto_infracao: autoInfracao,
        codigo_infracao: codigoInfracao,
      },
      cursor,
    );
  }

  @Get('cnpj/:cnpj')
  byCnpj(
    @Param('cnpj') cnpj: string,
    @Query('idUltimoRegistro') cursor?: string,
  ) {
    return this.read.list('infracao', { cnpj }, cursor);
  }

  @Get('cpf/:cpf')
  byCpf(@Param('cpf') cpf: string, @Query('idUltimoRegistro') cursor?: string) {
    return this.read.list('infracao', { cpf }, cursor);
  }

  @Get('habilitacaoEstrangeira/:identificacao')
  byHabilitacaoEstrangeira(
    @Param('identificacao') identificacao: string,
    @Query('idUltimoRegistro') cursor?: string,
  ) {
    return this.read.list(
      'infracao',
      { identificacao_hab_estr: identificacao },
      cursor,
    );
  }

  @Get(
    'ocorrencias/ait/:autoInfracao/orgaoAutuador/:orgao/infracao/:codigoInfracao',
  )
  ocorrenciasByAit(
    @Param('autoInfracao') autoInfracao: string,
    @Param('orgao') orgao: string,
    @Param('codigoInfracao') codigoInfracao: string,
  ) {
    return this.read.one('v_infracao_ocorrencias_by_ait', {
      codigo_orgao_autuador: orgao,
      auto_infracao: autoInfracao,
      codigo_infracao: codigoInfracao,
    });
  }

  @Get(
    'pagamentos/ait/:autoInfracao/orgaoAutuador/:orgao/infracao/:codigoInfracao',
  )
  pagamentosByAit(
    @Param('autoInfracao') autoInfracao: string,
    @Param('orgao') orgao: string,
    @Param('codigoInfracao') codigoInfracao: string,
  ) {
    return this.read.one('v_infracao_pagamentos_by_ait', {
      codigo_orgao_autuador: orgao,
      auto_infracao: autoInfracao,
      codigo_infracao: codigoInfracao,
    });
  }

  @Get('pgu/:pgu/uf/:uf')
  byPguUf(
    @Param('pgu') pgu: string,
    @Param('uf') uf: string,
    @Query('idUltimoRegistro') cursor?: string,
  ) {
    return this.read.list('infracao', { numero_pgu: pgu, uf }, cursor);
  }

  @Get('placa/:placa/exigibilidade/:situacaoExigibilidade')
  byPlacaExigibilidade(
    @Param('placa') placa: string,
    @Param('situacaoExigibilidade') situacaoExigibilidade: string,
    @Query('idUltimoRegistro') cursor?: string,
  ) {
    return this.read.list(
      'infracao',
      { placa, situacao_exigibilidade: situacaoExigibilidade },
      cursor,
    );
  }

  @Get('registroCnh/:cnh')
  byRegistroCnh(
    @Param('cnh') cnh: string,
    @Query('idUltimoRegistro') cursor?: string,
  ) {
    return this.read.list('infracao', { numero_registro_cnh: cnh }, cursor);
  }

  @Get('renainf/:numeroRenainf')
  byRenainf(
    @Param('numeroRenainf') numeroRenainf: string,
    @Query('idUltimoRegistro') cursor?: string,
  ) {
    return this.read.list(
      'infracao',
      { codigo_renainf: numeroRenainf },
      cursor,
    );
  }
}
