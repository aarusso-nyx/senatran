import { IsOptional, IsString } from 'class-validator';

/** Validated body for POST /v1/cdt/infracoes/{numeroAit}/reconhecimento. */
export class ReconhecimentoDto {
  @IsOptional() @IsString() canal?: string;
  @IsOptional() @IsString() cpf?: string;
}
