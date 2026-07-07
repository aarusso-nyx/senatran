import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class AgenteAutuadorDto {
  @IsString() cpf!: string;
  @IsString() matricula!: string;
}
class InfracaoAitDto {
  @IsString() codigoInfracao!: string;
  @IsString() dataInfracao!: string;
  @IsString() codigoMunicipio!: string;
  @IsDefined() @IsObject() local!: object;
  @IsOptional() @IsString() codigoDesdobramentoInfracao?: string;
  @IsOptional() @IsString() descricaoInfracao?: string;
}
class VeiculoAitDto {
  @IsString() placa!: string;
  @IsOptional() @IsString() codigoRenavam?: string;
  @IsOptional() @IsString() uf?: string;
  @IsOptional() @IsString() descricaoMarcaModelo?: string;
}

/** Validated body for POST /v1/renainf/autosInfracao. */
export class AutoInfracaoDto {
  @IsString() numeroAit!: string;
  @IsString() codigoOrgaoAutuador!: string;
  @IsDefined()
  @ValidateNested()
  @Type(() => AgenteAutuadorDto)
  agenteAutuador!: AgenteAutuadorDto;
  @IsOptional() @IsObject() dispositivo?: object;
  @IsDefined()
  @ValidateNested()
  @Type(() => InfracaoAitDto)
  infracao!: InfracaoAitDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => VeiculoAitDto)
  veiculo!: VeiculoAitDto;
  @IsOptional() @IsObject() condutor?: object;
  @IsOptional() @IsArray() evidencias?: unknown[];
  @IsOptional() @IsObject() assinaturas?: object;
  /** Date the AIT is transmitted to RENAINF; drives TRANSMISSION_EXPIRED. */
  @IsOptional() @IsString() dataTransmissao?: string;
  /** Intended notice channel; 'SNE' requires an SNE-adherent órgão. */
  @IsOptional() @IsString() canalNotificacao?: string;
}
