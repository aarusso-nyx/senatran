import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export const RESULTADO_EXAME = [
  'APTO',
  'APTO_COM_RESTRICOES',
  'INAPTO_TEMPORARIO',
  'INAPTO',
  'ENCAMINHADO_JUNTA',
  'PENDENTE',
] as const;
export const TIPO_PROCESSO = [
  'PRIMEIRA_HABILITACAO',
  'RENOVACAO',
  'MUDANCA_CATEGORIA',
  'ADICAO_CATEGORIA',
] as const;

class ClinicaDto {
  @IsString() codigoClinica!: string;
  @IsString() cnpj!: string;
}
class ExaminadorDto {
  @IsString() cpf!: string;
  @IsString() conselho!: string;
  @IsString() numeroConselho!: string;
  @IsString() uf!: string;
}
class CondutorExameDto {
  @IsString() cpf!: string;
  @IsString() nome!: string;
  @IsString() dataNascimento!: string;
}
class ProcessoExameDto {
  @IsString() numeroRenach!: string;
  @IsEnum(TIPO_PROCESSO) tipoProcesso!: (typeof TIPO_PROCESSO)[number];
  @IsOptional() @IsString() categoriaAtual?: string;
  @IsOptional() @IsString() categoriaPretendida?: string;
}
class ExameDto {
  @IsString() dataRealizacao!: string;
  @IsEnum(RESULTADO_EXAME) resultado!: (typeof RESULTADO_EXAME)[number];
  @IsOptional() @IsString() dataValidade?: string;
  @IsOptional() @IsArray() restricoes?: unknown[];
  @IsOptional() @IsString() observacoes?: string;
}

/** Validated body for POST /v1/renach/processos/{numeroRenach}/examesMedicos. */
export class ExameMedicoDto {
  @IsString() idAgendamento!: string;
  @IsDefined() @ValidateNested() @Type(() => ClinicaDto) clinica!: ClinicaDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => ExaminadorDto)
  examinador!: ExaminadorDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => CondutorExameDto)
  condutor!: CondutorExameDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => ProcessoExameDto)
  processo!: ProcessoExameDto;
  @IsDefined() @ValidateNested() @Type(() => ExameDto) exame!: ExameDto;
  @IsOptional() @IsArray() anexos?: unknown[];
  @IsOptional() @IsObject() assinaturaDigital?: object;
}
