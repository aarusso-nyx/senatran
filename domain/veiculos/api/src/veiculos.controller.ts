import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ReadService } from '../../../shared/api/src/common/read.service.js';

/**
 * WSDenatran `veiculos` endpoints (20). Thin: each method maps path params to a
 * prepared contract view via ReadService. No logic here (D-0003).
 */
@Controller('v1/veiculos')
export class VeiculosController {
  constructor(@Inject(ReadService) private readonly read: ReadService) {}

  @Get('placa/:placa')
  byPlaca(@Param('placa') placa: string) {
    return this.read.one('v_veiculo_by_placa', { placa });
  }

  @Get('chassi/:chassi')
  byChassi(@Param('chassi') chassi: string) {
    return this.read.one('v_veiculo_by_chassi', { chassi });
  }

  @Get('renavam/:renavam')
  byRenavam(@Param('renavam') renavam: string) {
    return this.read.one('v_veiculo_by_renavam', { codigo_renavam: renavam });
  }

  @Get('motor/:motor')
  byMotor(@Param('motor') motor: string) {
    return this.read.one('v_veiculo_by_motor', { numero_motor: motor });
  }

  @Get('cambio/:cambio')
  byCambio(@Param('cambio') cambio: string) {
    return this.read.one('v_veiculo_by_cambio', { numero_cambio: cambio });
  }

  @Get('proprietario/cpf/:identificacao')
  byProprietarioCpf(@Param('identificacao') identificacao: string) {
    return this.read.one('v_veiculos_by_proprietario_cpf', {
      id_proprietario: identificacao,
    });
  }

  @Get('proprietario/cnpj/:identificacao')
  byProprietarioCnpj(@Param('identificacao') identificacao: string) {
    return this.read.one('v_veiculos_by_proprietario_cnpj', {
      id_proprietario: identificacao,
    });
  }

  @Get('proprietario/cpf/:cpf/chassi/:chassi/renavam/:renavam')
  byProprietarioCpfChassiRenavam(
    @Param('cpf') cpf: string,
    @Param('chassi') chassi: string,
    @Param('renavam') renavam: string,
  ) {
    return this.read.one('v_veiculo_by_proprietario_cpf_chassi_renavam', {
      id_proprietario: cpf,
      chassi,
      codigo_renavam: renavam,
    });
  }

  @Get('proprietario/cpf/:cpf/placa/:placa/renavam/:renavam')
  byProprietarioCpfPlacaRenavam(
    @Param('cpf') cpf: string,
    @Param('placa') placa: string,
    @Param('renavam') renavam: string,
  ) {
    return this.read.one('v_veiculo_by_proprietario_cpf_placa_renavam', {
      id_proprietario: cpf,
      placa,
      codigo_renavam: renavam,
    });
  }

  @Get('proprietario/cnpj/:cnpj/chassi/:chassi/renavam/:renavam')
  byProprietarioCnpjChassiRenavam(
    @Param('cnpj') cnpj: string,
    @Param('chassi') chassi: string,
    @Param('renavam') renavam: string,
  ) {
    return this.read.one('v_veiculo_by_proprietario_cnpj_chassi_renavam', {
      id_proprietario: cnpj,
      chassi,
      codigo_renavam: renavam,
    });
  }

  @Get('proprietario/cnpj/:cnpj/placa/:placa/renavam/:renavam')
  byProprietarioCnpjPlacaRenavam(
    @Param('cnpj') cnpj: string,
    @Param('placa') placa: string,
    @Param('renavam') renavam: string,
  ) {
    return this.read.one('v_veiculo_by_proprietario_cnpj_placa_renavam', {
      id_proprietario: cnpj,
      placa,
      codigo_renavam: renavam,
    });
  }

  @Get(
    'codigoSegurancaCrv/:codigoSegurancaCrv/cpf/:cpf/renavam/:renavam/placa/:placa',
  )
  csvByCpf(
    @Param('codigoSegurancaCrv') codigoSegurancaCrv: string,
    @Param('renavam') renavam: string,
    @Param('placa') placa: string,
  ) {
    return this.read.one('v_veiculo_codigo_seguranca_crv_by_cpf', {
      codigo_seguranca_crv: codigoSegurancaCrv,
      renavam,
      placa,
    });
  }

  @Get(
    'codigoSegurancaCrv/:codigoSegurancaCrv/cnpj/:cnpj/renavam/:renavam/placa/:placa',
  )
  csvByCnpj(
    @Param('codigoSegurancaCrv') codigoSegurancaCrv: string,
    @Param('renavam') renavam: string,
    @Param('placa') placa: string,
  ) {
    return this.read.one('v_veiculo_codigo_seguranca_crv_by_cnpj', {
      codigo_seguranca_crv: codigoSegurancaCrv,
      renavam,
      placa,
    });
  }

  @Get('comunicacaoVenda/cpf/:cpf/renavam/:renavam/placa/:placa')
  comunicacaoVendaCpf(
    @Param('cpf') cpf: string,
    @Param('renavam') renavam: string,
    @Param('placa') placa: string,
  ) {
    return this.read.one('v_comunicacao_venda_by_cpf', { cpf, renavam, placa });
  }

  @Get('comunicacaoVenda/cnpj/:cnpj/renavam/:renavam/placa/:placa')
  comunicacaoVendaCnpj(
    @Param('cnpj') cnpj: string,
    @Param('renavam') renavam: string,
    @Param('placa') placa: string,
  ) {
    return this.read.one('v_comunicacao_venda_by_cnpj', {
      cnpj,
      renavam,
      placa,
    });
  }

  @Get('multaInterestadual/cpf/:cpf/renavam/:renavam/placa/:placa')
  multaCpf(
    @Param('cpf') cpf: string,
    @Param('renavam') renavam: string,
    @Param('placa') placa: string,
  ) {
    return this.read.one('v_multa_interestadual_by_cpf', {
      cpf,
      renavam,
      placa,
    });
  }

  @Get('multaInterestadual/cnpj/:cnpj/renavam/:renavam/placa/:placa')
  multaCnpj(
    @Param('cnpj') cnpj: string,
    @Param('renavam') renavam: string,
    @Param('placa') placa: string,
  ) {
    return this.read.one('v_multa_interestadual_by_cnpj', {
      cnpj,
      renavam,
      placa,
    });
  }

  @Get('enderecoPossuidor/placa/:placa/renavam/:renavam')
  enderecoPossuidorPlacaRenavam(
    @Param('placa') placa: string,
    @Param('renavam') renavam: string,
  ) {
    return this.read.one('v_endereco_possuidor_by_placa_and_renavam', {
      renavam,
      placa,
    });
  }

  @Get('enderecoPossuidor/placa/:placa')
  enderecoPossuidorPlaca(@Param('placa') placa: string) {
    return this.read.one('v_endereco_possuidor_by_placa', { placa });
  }

  @Get('recall/chassi/:chassi')
  recall(@Param('chassi') chassi: string) {
    return this.read.one('v_veiculo_recall_by_chassi', { chassi });
  }
}
