import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TIPO_PROCESSO } from './exame-medico.dto.js';

/**
 * Validated body for POST /v1/renach/processos — opens a new RENACH process.
 *
 * `cpf` is the candidate's document (not the x-cpf-usuario auth header) and need
 * not be an existing condutor: a PRIMEIRA_HABILITACAO candidate is not yet a
 * driver. The mock validates shape only, consistent with its dev-only intent.
 */
export class AberturaProcessoRenachDto {
  @IsString() cpf!: string;
  @IsEnum(TIPO_PROCESSO) tipoProcesso!: (typeof TIPO_PROCESSO)[number];
  @IsOptional() @IsString() categoriaAtual?: string;
  @IsOptional() @IsString() categoriaPretendida?: string;
}
