import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { AppModule } from '../../apps/api/src/app.module.js';

/** Auth headers accepted by the mock (valid CPF + allowlisted dev cert CN). */
export const AUTH = {
  'x-cpf-usuario': '12345678909',
  'x-client-cert-cn': 'senatran-dev-client',
} as const;

export interface TestApp {
  app: INestApplication;
  server: Server;
  close: () => Promise<void>;
}

/**
 * Boot the full app against the real local database (integration/e2e tiers).
 * Mirrors main.ts: global ValidationPipe; the guard + filter come from AppModule.
 */
export async function createE2eApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();
  return {
    app,
    server: app.getHttpServer() as Server,
    close: () => app.close(),
  };
}
