import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { RequerenteDto } from './defesa-previa.dto.js';

export const INSTANCIA = ['JARI', 'SEGUNDA_INSTANCIA'] as const;

/** Validated body for POST /v1/renainf/processosAdministrativos/{idProcesso}/recursos. */
export class RecursoDto {
  @IsEnum(INSTANCIA) instancia!: (typeof INSTANCIA)[number];
  @IsDefined()
  @ValidateNested()
  @Type(() => RequerenteDto)
  requerente!: RequerenteDto;
  @IsString() fundamentacao!: string;
  @IsOptional() @IsString() idRecursoAnterior?: string;
  @IsOptional() @IsString() dataProtocolo?: string;
  @IsOptional() @IsArray() anexos?: unknown[];
  @IsOptional() @IsString() canal?: string;
}
