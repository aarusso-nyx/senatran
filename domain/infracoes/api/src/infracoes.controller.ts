import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ReadService } from '../../../shared/api/src/common/read.service.js';

/**
 * WSDenatran `infracoes` endpoints. Thin: each method maps path params to a
 * prepared contract view via ReadService. No logic here (D-0003).
 */
@Controller('v1/infracoes')
export class InfracoesController {
  constructor(@Inject(ReadService) private readonly read: ReadService) {}

  @Get('ait/:autoInfracao/orgaoAutuador/:orgao/infracao/:codigoInfracao')
  byAit(
    @Param('autoInfracao') autoInfracao: string,
    @Param('orgao') orgao: string,
    @Param('codigoInfracao') codigoInfracao: string,
  ) {
    return this.read.one('v_infracoes_by_ait', {
      codigo_orgao_autuador: orgao,
      auto_infracao: autoInfracao,
      codigo_infracao: codigoInfracao,
    });
  }

  @Get('cnpj/:cnpj')
  byCnpj(@Param('cnpj') cnpj: string) {
    return this.read.one('v_infracoes_by_cnpj', { cnpj });
  }

  @Get('cpf/:cpf')
  byCpf(@Param('cpf') cpf: string) {
    return this.read.one('v_infracoes_by_cpf', { cpf });
  }

  @Get('habilitacaoEstrangeira/:identificacao')
  byHabilitacaoEstrangeira(@Param('identificacao') identificacao: string) {
    return this.read.one('v_infracoes_by_habilitacao_estrangeira', {
      identificacao_hab_estr: identificacao,
    });
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
  byPguUf(@Param('pgu') pgu: string, @Param('uf') uf: string) {
    return this.read.one('v_infracoes_by_pgu_and_uf', { numero_pgu: pgu, uf });
  }

  @Get('placa/:placa/exigibilidade/:situacaoExigibilidade')
  byPlacaExigibilidade(
    @Param('placa') placa: string,
    @Param('situacaoExigibilidade') situacaoExigibilidade: string,
  ) {
    return this.read.one('v_infracoes_by_placa_and_exigibilidade', {
      placa,
      situacao_exigibilidade: situacaoExigibilidade,
    });
  }

  @Get('registroCnh/:cnh')
  byRegistroCnh(@Param('cnh') cnh: string) {
    return this.read.one('v_infracoes_by_registro_cnh', {
      numero_registro_cnh: cnh,
    });
  }

  @Get('renainf/:numeroRenainf')
  byRenainf(@Param('numeroRenainf') numeroRenainf: string) {
    return this.read.one('v_infracoes_by_renainf', {
      codigo_renainf: numeroRenainf,
    });
  }
}
