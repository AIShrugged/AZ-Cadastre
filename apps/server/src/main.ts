import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { Logger } from '@cadastre/logger';

import type { Environment } from './config/index.js';
import { ServerModule } from './server.module.js';

async function bootstrap(): Promise<void> {
  // Buffered until the logger exists: without this, everything Nest says while
  // it builds the container goes out in its own format, and the first lines of
  // a start-up — the ones that say why it did not start — are the ones missing
  // from the log (ADR-0008).
  const app = await NestFactory.create(ServerModule, { bufferLogs: true });
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  const logger = app.get(Logger).child({ scope: 'Bootstrap' });

  app.useLogger(app.get(Logger));

  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableCors({ origin: config.get('web', { infer: true }).origin });

  app.setGlobalPrefix('api');

  const service = config.get('service', { infer: true });
  await app.listen(service.port, service.host);

  // Which stage is answered by a model and which by its offline stand-in is the
  // first question asked of any surprising run, and reading it off the
  // environment by hand gets it wrong. It is on the line that says we started.
  const verification = config.get('verification', { infer: true });
  logger.log('Server listening', {
    url: `http://${service.host}:${service.port}/api`,
    webOrigin: config.get('web', { infer: true }).origin,
    logLevel: config.get('logger', { infer: true }).level,
    providers: {
      ocr: `${verification.ocr.provider}:${verification.ocr.model || '—'}`,
      segmenter: `${verification.segmenter.provider}:${verification.segmenter.model || '—'}`,
      classifier: `${verification.classifier.provider}:${verification.classifier.model || '—'}`,
      extractor: `${verification.extractor.provider}:${verification.extractor.model || '—'}`,
      crossChecker: `${verification.crossChecker.provider}:${verification.crossChecker.model || '—'}`,
      registry: `${verification.registry.provider}:${verification.registry.provider === 'http' ? verification.registry.url : '—'}`,
    },
    storage: {
      endpoint: verification.storage.endpoint,
      bucket: verification.storage.bucket,
    },
    pdf: verification.pdf,
  });
}

void bootstrap();
