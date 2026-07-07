import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { WsdenatranError } from './wsdenatran-error.js';

/**
 * Global exception filter (INV-HTTP-001). Renders EVERY error as the WSDenatran
 * envelope `{ returnCode, message }`, with the HTTP status equal to returnCode.
 * No other error shape ever leaves the service.
 */
@Catch()
export class WsdenatranExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, message } = normalize(exception);
    res.status(status).json({ returnCode: status, message });
  }
}

function normalize(e: unknown): { status: number; message: string } {
  if (e instanceof WsdenatranError) {
    return { status: e.returnCode, message: e.message };
  }
  if (e instanceof HttpException) {
    const status = e.getStatus();
    const body = e.getResponse();
    // ValidationPipe/BadRequest → 400 with a plain message.
    const message =
      typeof body === 'string'
        ? body
        : Array.isArray((body as { message?: unknown }).message)
          ? (body as { message: string[] }).message.join('; ')
          : ((body as { message?: string }).message ?? e.message);
    return { status, message };
  }
  return { status: 500, message: 'Erro interno.' };
}
