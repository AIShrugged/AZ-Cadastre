import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { Logger } from '@cadastre/logger';

import { RegistrySource } from './application/index.js';
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

  const database = named(config.get('database', { infer: true }).url);
  const held = await counted(app.get(RegistrySource));

  // Which records are being served is the first question asked of any
  // surprising answer, so how many there are is on the line that says we
  // started. A register answering `NotFound` for everything and a register with
  // an empty database look identical from the caller's side.
  if (held === null) {
    logger.warn('Register listening with no schema in its database', {
      url: `http://${service.host}:${service.port}/api`,
      database,
      // Named here rather than left to whoever reads the stack trace: this is
      // the whole of the fix, and the register is running so it can be applied.
      apply: 'pnpm db:deploy && pnpm db:seed',
      logLevel: config.get('logger', { infer: true }).level,
    });

    return;
  }

  logger.log('Register listening', {
    url: `http://${service.host}:${service.port}/api`,
    database,
    records: held,
    logLevel: config.get('logger', { infer: true }).level,
  });
}

/**
 * How many records the register holds, or null when it cannot say.
 *
 * It cannot say when the database has no schema — which is a deployment that
 * has not been migrated yet, not a bug, and above all not a reason to take the
 * process down. A register that exits on the way up cannot be migrated: with a
 * restart policy it crash-loops, and there is no container to `docker exec`
 * into. So it starts, says loudly what is wrong and how to fix it, and answers
 * every lookup with an error until somebody does — which the caller already
 * treats as a register it could not reach, and reports as a property it could
 * not confirm (ADR-0009).
 */
async function counted(source: RegistrySource): Promise<number | null> {
  try {
    return await source.size();
  } catch {
    return null;
  }
}

/** The database, never the credentials in front of it. */
function named(url: string): string {
  try {
    const parsed = new URL(url);

    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return 'unreadable';
  }
}

void bootstrap();
