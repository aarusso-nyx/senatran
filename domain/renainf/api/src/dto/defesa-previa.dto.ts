import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export const TIPO_REQUERENTE = [
  'PROPRIETARIO',
  'CONDUTOR_IDENTIFICADO',
  'REPRESENTANTE_LEGAL',
] as const;

export class RequerenteDto {
  @IsEnum(TIPO_REQUERENTE) tipoRequerente!: (typeof TIPO_REQUERENTE)[number];
  @IsString() numeroDocumento!: string;
  @IsOptional() @IsString() nome?: string;
}

/** Validated body for POST /v1/renainf/processosAdministrativos/{idProcesso}/defesasPrevias. */
export class DefesaPreviaDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => RequerenteDto)
  requerente!: RequerenteDto;
  @IsString() fundamentacao!: string;
  @IsString() dataProtocolo!: string;
  @IsOptional() @IsArray() anexos?: unknown[];
  @IsOptional() @IsString() canal?: string;
}
