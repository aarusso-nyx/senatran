/**
 * Domain error carrying the WSDenatran envelope. Thrown anywhere in the request
 * path; rendered by WsdenatranExceptionFilter as `{ returnCode, message }` with
 * the HTTP status equal to `returnCode`.
 */
export class WsdenatranError extends Error {
  constructor(
    readonly returnCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'WsdenatranError';
  }
}

/** 401 — certificate/CPF authentication failure. */
export const unauthorized = (
  message = 'Não autorizado: falha na autenticação do certificado ou do CPF do usuário.',
): WsdenatranError => new WsdenatranError(401, message);

/** 404 — resource not found. */
export const notFound = (
  message = 'Recurso não encontrado.',
): WsdenatranError => new WsdenatranError(404, message);

/** 402 — business rule / state-machine violation (domain code carried in message). */
export const businessError = (code: string, message: string): WsdenatranError =>
  new WsdenatranError(402, `${code} — ${message}`);

/** 400 — invalid request. */
export const badRequest = (message = 'Requisição inválida.'): WsdenatranError =>
  new WsdenatranError(400, message);
