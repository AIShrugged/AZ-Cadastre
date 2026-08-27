import { z } from 'zod';

import type { LoggerModuleOptions } from '@cadastre/logger';

/**
 * The whole environment of the stand-in, validated once at startup. It reads
 * `process.env` here and nowhere else, the same way the server does.
 */
export const EnvironmentSchema = z
  .object({
    SERVICE_PORT: z.coerce.number().int().positive().default(3100),
    SERVICE_HOST: z.string().nonempty().default('0.0.0.0'),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    LOG_PRETTY: z
      .enum(['true', 'false'])
      .default('true')
      .transform(v => v === 'true'),

    /*
     * The register's own database, and nothing else's. `cadastre-db` belongs to
     * the verification context, which owns it; this is a different system that
     * happens to run on the same server, and the day a join is written between
     * a submission and the record of a registration is the day the boundary
     * stopped meaning anything (ADR-0010).
     */
    DATABASE_URL: z.string().nonempty(),
  })
  .transform(env => ({
    service: {
      host: env.SERVICE_HOST,
      port: env.SERVICE_PORT,
    },
    logger: {
      service: 'registry-stub',
      level: env.LOG_LEVEL,
      pretty: env.LOG_PRETTY,
    } satisfies LoggerModuleOptions,
    database: {
      url: env.DATABASE_URL,
    },
  }));

export type Environment = z.infer<typeof EnvironmentSchema>;
