import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { loadConfig } from '../../../domain/shared/api/src/config/configuration.js';

/**
 * Bootstraps the SENATRAN mock HTTP server.
 *
 * The WSDenatran contract versions every path under `/v1`, so controllers own
 * the `v1/...` prefix and the global prefix is left empty by default.
 */
async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  if (config.apiPrefix) {
    app.setGlobalPrefix(config.apiPrefix);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.enableShutdownHooks();

  await app.listen(config.port);
  Logger.log(
    `SENATRAN mock listening on http://localhost:${config.port} (env=${config.nodeEnv})`,
    'Bootstrap',
  );
}

void bootstrap();
