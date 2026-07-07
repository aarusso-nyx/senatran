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
import { RESULTADO_EXAME } from './exame-medico.dto.js';

class AvaliacaoDto {
  @IsString() dataRealizacao!: string;
  @IsEnum(RESULTADO_EXAME) resultado!: (typeof RESULTADO_EXAME)[number];
  @IsOptional() @IsString() dataValidade?: string;
  @IsOptional() @IsArray() bateriaTestes?: unknown[];
  @IsOptional() @IsString() observacoes?: string;
}

/** Validated body for POST /v1/renach/processos/{numeroRenach}/avaliacoesPsicologicas. */
export class AvaliacaoPsicologicaDto {
  @IsString() idAgendamento!: string;
  @IsDefined() @IsObject() clinica!: object;
  @IsDefined() @IsObject() examinador!: object;
  @IsDefined()
  @ValidateNested()
  @Type(() => AvaliacaoDto)
  avaliacao!: AvaliacaoDto;
  @IsOptional() @IsObject() assinaturaDigital?: object;
}
