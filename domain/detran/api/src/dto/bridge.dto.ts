import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Validated body for the State-DETRAN bridge POSTs. Permissive by design: each
 * bridge forwards a different national payload under `dados`, while the common
 * `codigoOrgao` / `versaoLeiaute` drive the profile and layout checks in the
 * service (so the DETRAN domain code travels in the error message).
 */
export class BridgeRequestDto {
  @IsOptional() @IsString() codigoOrgao?: string;
  @IsOptional() @IsString() versaoLeiaute?: string;
  @IsOptional() @IsString() placa?: string;
  @IsOptional() @IsString() renavam?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() numeroAit?: string;
  @IsOptional() @IsObject() dados?: Record<string, unknown>;
}
