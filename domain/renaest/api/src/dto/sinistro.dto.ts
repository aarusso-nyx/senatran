import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Crash severity — drives the incomplete-victim-data business rule. */
export const GRAVIDADE_SINISTRO = [
  'SEM_VITIMA',
  'COM_VITIMA_FERIDA',
  'COM_VITIMA_FATAL',
] as const;

/**
 * Cross-links to the other national bases (all optional). A crash may reference
 * an existing vehicle (RENAVAM), driver (RENACH/condutor) or infraction (AIT).
 * The mock validates shape only — it never resolves them against real bases.
 */
export class ReferenciasSinistroDto {
  @IsOptional() @IsString() renavam?: string;
  @IsOptional() @IsString() cpfCondutor?: string;
  @IsOptional() @IsString() numeroAit?: string;
}

/**
 * Validated body for POST /v1/renaest/sinistros — submits a crash/sinister
 * record. Structural validation only (400 on a malformed body); the coded
 * layout (`RENAEST.CRASH.INVALID_LAYOUT`) and completeness
 * (`RENAEST.CRASH.INCOMPLETE_DATA`) rules are enforced in the service so the
 * domain code travels in the error message.
 */
export class SinistroDto {
  @IsString() dataHoraSinistro!: string;
  @IsString() @Length(2, 2) uf!: string;
  @IsString() codigoMunicipio!: string;
  @IsEnum(GRAVIDADE_SINISTRO)
  gravidade!: (typeof GRAVIDADE_SINISTRO)[number];
  @IsOptional() @IsString() orgaoResponsavel?: string;
  @IsOptional() @IsString() versaoLeiaute?: string;
  @IsOptional() @IsString() local?: string;
  @IsOptional() @IsString() codigoTipoSinistro?: string;
  @IsOptional() @IsString() condicoesVia?: string;
  @IsOptional() @IsString() condicoesMeteorologicas?: string;
  @IsOptional() @IsString() dataTransmissao?: string;
  @IsOptional() @IsArray() veiculos?: unknown[];
  @IsOptional() @IsArray() pessoas?: unknown[];
  @IsOptional() @IsArray() vitimas?: unknown[];
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReferenciasSinistroDto)
  referencias?: ReferenciasSinistroDto;
}

/** Validated body for POST /v1/renaest/sinistros/lotes — a batch of crashes. */
export class SinistroLoteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SinistroDto)
  sinistros!: SinistroDto[];
}

/** Validated body for complement/correction submissions. */
export class RetificacaoSinistroDto {
  @IsOptional() @IsString() motivo?: string;
  @IsOptional() @IsString() versaoLeiaute?: string;
  @IsOptional() @IsString() gravidade?: string;
  @IsOptional() @IsString() local?: string;
  @IsOptional() @IsArray() vitimas?: unknown[];
  @IsOptional() @IsArray() veiculos?: unknown[];
  @IsOptional() @IsArray() pessoas?: unknown[];
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReferenciasSinistroDto)
  referencias?: ReferenciasSinistroDto;
}
