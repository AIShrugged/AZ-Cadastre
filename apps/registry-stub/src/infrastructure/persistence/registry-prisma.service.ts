import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { Logger } from '@cadastre/logger';

import type { Environment } from '../../config/index.js';

import { PrismaClient } from './generated/client.js';

/**
 * The generated client is generic in the events it emits, and `class X extends
 * PrismaClient` instantiates that generic with its default — `never` — so
 * `$on('query')` does not typecheck however the constructor is configured.
 * The cast says which event the `log` option below actually asks for; there is
 * no way to state it in the extends clause itself.
 */
const QueryEmittingPrismaClient = PrismaClient as unknown as new (
  options: ConstructorParameters<typeof PrismaClient>[0],
) => PrismaClient<'query'>;

@Injectable()
export class RegistryPrismaService
  extends QueryEmittingPrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  readonly #logger: Logger;
  readonly #url: string;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(Logger) logger: Logger,
  ) {
    const { url } = config.get('database', { infer: true });

    super({
      adapter: new PrismaPg({ connectionString: url }),
      // Emitted rather than printed, so every statement goes through the one
      // logger with the rest of the run (ADR-0008).
      log: [{ emit: 'event', level: 'query' }],
    });

    this.#url = url;
    this.#logger = logger.child({ scope: RegistryPrismaService.name });
  }

  async onModuleInit(): Promise<void> {
    this.$on('query', event => {
      this.#logger.debug('SQL', {
        query: event.query,
        durationMs: event.duration,
      });
      // The parameters are the data itself — an address, an owner's name off
      // somebody's papers — so they are one level further down than the
      // statement that carried them, and never on by default.
      this.#logger.verbose('SQL parameters', { params: event.params });
    });

    await this.$connect();

    this.#logger.log('Connected to PostgreSQL', describe(this.#url));
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.#logger.log('Disconnected from PostgreSQL');
  }
}

/** Host and database, never the credentials in front of them. */
function describe(url: string): Record<string, unknown> {
  try {
    const parsed = new URL(url);

    return {
      host: parsed.host,
      database: parsed.pathname.replace(/^\//, ''),
      schema: parsed.searchParams.get('schema') ?? 'public',
    };
  } catch {
    return {};
  }
}
