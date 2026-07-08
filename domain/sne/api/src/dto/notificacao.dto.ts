import { IsIn, IsOptional, IsString } from 'class-validator';

/** Delivery channels modeled by the mock. `INDISPONIVEL` forces a PENDENTE delivery. */
export const CANAL_SNE = ['APP_CDT', 'EMAIL', 'SMS', 'INDISPONIVEL'] as const;

/**
 * Validated body for POST /v1/sne/notificacoes/autuacao and /penalidade.
 * Structural validation only; adherence, deadline and channel rules are enforced
 * in the service so the SNE domain code travels in the error message.
 */
export class NotificacaoDto {
  @IsString() numeroAit!: string;
  @IsString() codigoOrgaoAutuador!: string;
  @IsOptional() @IsString() idProcesso?: string;
  @IsOptional() @IsString() placa?: string;
  @IsOptional() @IsString() cpfDestinatario?: string;
  @IsOptional() @IsIn(CANAL_SNE) canal?: (typeof CANAL_SNE)[number];
  @IsOptional() @IsString() dataInfracao?: string;
  @IsOptional() @IsString() dataNotificacao?: string;
  @IsOptional() @IsString() mensagem?: string;
}

/** Validated body for POST /v1/sne/notificacoes/{protocolo}/cancelamento. */
export class CancelamentoDto {
  @IsOptional() @IsString() motivo?: string;
}
