import { describe, expect, it } from 'vitest';
import { CpfUsuarioGuard } from './cpf-usuario.guard.js';
import { ScenarioService } from './scenario.service.js';
import { WsdenatranError } from './wsdenatran-error.js';

type Headers = Record<string, string>;
const ctx = (headers: Headers) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as never as import('@nestjs/common').ExecutionContext & {
    __public: boolean;
  };

const guardWith = (opts: {
  isPublic?: boolean;
  forced?: { status: number; message: string } | null;
  certOk?: boolean;
}) => {
  const reflector = {
    getAllAndOverride: () => opts.isPublic ?? false,
  } as never;
  const scenario = {
    forced: async () => opts.forced ?? null,
    certAllowed: async () => opts.certOk ?? true,
  } as unknown as ScenarioService;
  return new CpfUsuarioGuard(reflector, scenario);
};

describe('CpfUsuarioGuard', () => {
  it('allows public routes without auth', async () => {
    const g = guardWith({ isPublic: true });
    expect(await g.canActivate(ctx({}))).toBe(true);
  });

  it('rejects a missing x-cpf-usuario with 401', async () => {
    const g = guardWith({});
    await expect(g.canActivate(ctx({}))).rejects.toMatchObject({
      returnCode: 401,
    });
  });

  it('rejects a malformed x-cpf-usuario with 401', async () => {
    const g = guardWith({});
    await expect(
      g.canActivate(ctx({ 'x-cpf-usuario': 'abc' })),
    ).rejects.toBeInstanceOf(WsdenatranError);
  });

  it('applies a forced scenario for the reserved CPF', async () => {
    const g = guardWith({ forced: { status: 401, message: 'reserved' } });
    await expect(
      g.canActivate(
        ctx({
          'x-cpf-usuario': '00000000000',
          'x-client-cert-cn': 'senatran-dev-client',
        }),
      ),
    ).rejects.toMatchObject({ returnCode: 401 });
  });

  it('rejects an unrecognized certificate CN with 401', async () => {
    const g = guardWith({ certOk: false });
    await expect(
      g.canActivate(
        ctx({ 'x-cpf-usuario': '12345678909', 'x-client-cert-cn': 'nope' }),
      ),
    ).rejects.toMatchObject({ returnCode: 401 });
  });

  it('allows a well-formed CPF with an accepted cert', async () => {
    const g = guardWith({ certOk: true });
    expect(
      await g.canActivate(
        ctx({
          'x-cpf-usuario': '12345678909',
          'x-client-cert-cn': 'senatran-dev-client',
        }),
      ),
    ).toBe(true);
  });
});
