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

    /*
     * Who says which of the archive's registers an uploaded workbook is.
     * `mock` is the register's own rule, which scores the file's sheet names
     * and column headers against the catalogue and needs no key and no network;
     * `openrouter` asks a model to recognise the same shape, which is what a
     * file from an office that renamed a sheet needs. The two are asked the
     * same question so that the second can be checked against the first
     * (ADR-0012 §3), and the default is the one that runs offline.
     */
    WORKBOOK_CLASSIFIER_PROVIDER: z.enum(['mock', 'openrouter']).default('mock'), // prettier-ignore
    WORKBOOK_CLASSIFIER_MODEL: z.string().default('openai/gpt-4o'),

    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
    OPENROUTER_APP_TITLE: z.string().default('AZ-Cadastre'),
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
    classifier: {
      provider: env.WORKBOOK_CLASSIFIER_PROVIDER,
      model: env.WORKBOOK_CLASSIFIER_MODEL,
    },
    openrouter: {
      apiKey: env.OPENROUTER_API_KEY,
      baseUrl: env.OPENROUTER_BASE_URL,
      appTitle: env.OPENROUTER_APP_TITLE,
    },
  }));

export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * The part of the environment an adapter is handed, rather than the whole of it.
 *
 * A token and not `ConfigService`, so that an adapter names what it needs and a
 * spec can build one without a Nest container.
 */
export const REGISTRY_OPTIONS = Symbol('REGISTRY_OPTIONS');

export type RegistryOptions = {
  readonly classifier: Environment['classifier'];
  readonly openrouter: Environment['openrouter'];
};
