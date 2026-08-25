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
     * Where the records are read from. A directory rather than a bundled
     * module, so the answers can be changed without a rebuild — which is the
     * whole point of a stand-in: the interesting cases (an address absent, an
     * owner who changed at the 2008 handover, two records for one address) are
     * data, and whoever is testing against it should be able to add one.
     */
    REGISTRY_FIXTURES: z.string().nonempty().default('fixtures'),
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
    fixtures: {
      directory: env.REGISTRY_FIXTURES,
    },
  }));

export type Environment = z.infer<typeof EnvironmentSchema>;
