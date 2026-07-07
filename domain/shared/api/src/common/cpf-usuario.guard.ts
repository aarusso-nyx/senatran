import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ScenarioService } from './scenario.service.js';
import { unauthorized, WsdenatranError } from './wsdenatran-error.js';
import { IS_PUBLIC } from './public.decorator.js';

/**
 * Global auth guard (INV-AUTH-001). Every endpoint requires a well-formed
 * `x-cpf-usuario`; when cert simulation is on, an allowlisted `x-client-cert-cn`
 * is also required. The reserved CPF 00000000000 forces 401. Routes marked
 * @Public (health) are exempt.
 */
@Injectable()
export class CpfUsuarioGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ScenarioService) private readonly scenario: ScenarioService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const cpf = header(req, 'x-cpf-usuario');
    if (!cpf || !/^\d{11}$/.test(cpf)) {
      throw unauthorized(
        'Não autorizado: cabeçalho x-cpf-usuario ausente ou inválido.',
      );
    }

    const forced = await this.scenario.forced('cpf_usuario', cpf);
    if (forced) throw new WsdenatranError(forced.status, forced.message);

    const certCn = header(req, 'x-client-cert-cn');
    if (!(await this.scenario.certAllowed(certCn))) {
      throw unauthorized(
        'Não autorizado: certificado do cliente não reconhecido.',
      );
    }
    return true;
  }
}

function header(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}
