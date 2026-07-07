import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ReadService } from '../../../shared/api/src/common/read.service.js';

/**
 * WSDenatran `condutores` endpoints. Thin: each method maps path params to a
 * prepared contract view via ReadService. No logic here (D-0003).
 */
@Controller('v1/condutores')
export class CondutoresController {
  constructor(@Inject(ReadService) private readonly read: ReadService) {}

  @Get('cpf/:cpf')
  byCpf(@Param('cpf') cpf: string) {
    return this.read.one('v_condutores_by_cpf', { cpf });
  }

  @Get('cpf/:cpf/registroCnh/:numeroRegistroCnh')
  byCpfRegistroCnh(
    @Param('cpf') cpf: string,
    @Param('numeroRegistroCnh') numeroRegistroCnh: string,
  ) {
    return this.read.one('v_condutores_by_cpf_and_registro_cnh', {
      cpf,
      numero_registro: numeroRegistroCnh,
    });
  }

  @Get('formularioRenach/:formularioRenach')
  byFormularioRenach(@Param('formularioRenach') formularioRenach: string) {
    return this.read.one('v_condutores_by_formulario_renach', {
      numero_formulario_renach: formularioRenach,
    });
  }

  @Get(
    'imagens/cpf/:cpf/registroCnh/:numeroRegistro/segurancaCnh/:numeroSeguranca',
  )
  imagens(
    @Param('cpf') cpf: string,
    @Param('numeroRegistro') numeroRegistro: string,
    @Param('numeroSeguranca') numeroSeguranca: string,
  ) {
    return this.read.one('v_condutor_imagens_by_cpf_registro_cnh_seguranca', {
      cpf,
      numero_registro: numeroRegistro,
      numero_seguranca: numeroSeguranca,
    });
  }

  @Get('impedimento/:impedimento')
  byImpedimento(@Param('impedimento') impedimento: string) {
    return this.read.one('v_condutores_by_impedimento', {
      numero_lista_impedimento: impedimento,
    });
  }

  @Get('infracoes/registroCnh/:numeroRegistroCnh')
  infracoesByRegistroCnh(
    @Param('numeroRegistroCnh') numeroRegistroCnh: string,
  ) {
    return this.read.one('v_condutor_infracoes_by_registro_cnh', {
      numero_registro_cnh: numeroRegistroCnh,
    });
  }

  @Get(
    'nomeCondutor/:nomeCondutor/dataNascimento/:dataNascimento/nomeMae/:nomeMae',
  )
  byDadosIdentificatorios(
    @Param('nomeCondutor') nomeCondutor: string,
    @Param('dataNascimento') dataNascimento: string,
    @Param('nomeMae') nomeMae: string,
  ) {
    return this.read.one('v_condutores_by_dados_identificatorios', {
      nome: nomeCondutor,
      data_nascimento: dataNascimento,
      nome_mae: nomeMae,
    });
  }

  @Get('pgu/:pgu')
  byPgu(@Param('pgu') pgu: string) {
    return this.read.one('v_condutores_by_pgu', { numero_pgu: pgu });
  }

  @Get('pid/:pid')
  byPid(@Param('pid') pid: string) {
    return this.read.one('v_condutores_by_pid', { numero_formulario_pid: pid });
  }

  @Get('registroCnh/:numeroRegistroCnh')
  byRegistroCnh(@Param('numeroRegistroCnh') numeroRegistroCnh: string) {
    return this.read.one('v_condutores_by_registro_cnh', {
      numero_registro: numeroRegistroCnh,
    });
  }

  @Get(
    'retrato/cpf/:cpf/registroCnh/:numeroRegistro/segurancaCnh/:numeroSeguranca',
  )
  retrato(
    @Param('cpf') cpf: string,
    @Param('numeroRegistro') numeroRegistro: string,
    @Param('numeroSeguranca') numeroSeguranca: string,
  ) {
    return this.read.one('v_condutor_retrato_by_cpf_registro_cnh_seguranca', {
      cpf,
      numero_registro: numeroRegistro,
      numero_seguranca: numeroSeguranca,
    });
  }

  @Get(
    'validacao/cpf/:cpf/registroCnh/:numeroRegistro/segurancaCnh/:numeroSeguranca',
  )
  validacao(
    @Param('cpf') cpf: string,
    @Param('numeroRegistro') numeroRegistro: string,
    @Param('numeroSeguranca') numeroSeguranca: string,
  ) {
    return this.read.one('v_condutor_validacao_by_cpf_registro_cnh_seguranca', {
      cpf,
      numero_registro: numeroRegistro,
      numero_seguranca: numeroSeguranca,
    });
  }
}
