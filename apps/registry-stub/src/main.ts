import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { Logger } from '@cadastre/logger';

import type { Environment } from './config/index.js';
import { RegistryModule } from './registry.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(RegistryModule, { bufferLogs: true });
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  const logger = app.get(Logger).child({ scope: 'Bootstrap' });

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.setGlobalPrefix('api');

  const service = config.get('service', { infer: true });
  await app.listen(service.port, service.host);

  // Which records are being served is the first question asked of any
  // surprising answer, so the directory is on the line that says we started.
  logger.log('Register listening', {
    url: `http://${service.host}:${service.port}/api`,
    fixtures: config.get('fixtures', { infer: true }).directory,
    logLevel: config.get('logger', { infer: true }).level,
  });
}

void bootstrap();
