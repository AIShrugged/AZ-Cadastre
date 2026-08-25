import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { Logger } from '@cadastre/logger';

import {
  VERIFICATION_OPTIONS,
  type VerificationModuleOptions,
} from '../../verification.module-defs.js';

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
export class VerificationPrismaService
  extends QueryEmittingPrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger: Logger;
  private readonly url: string;

  constructor(
    @Inject(VERIFICATION_OPTIONS) options: VerificationModuleOptions,
    @Inject(Logger) logger: Logger,
  ) {
    // From the options the composition root handed in rather than
    // the config module ahead of this one.
    const { url } = options.database;

    super({
      adapter: new PrismaPg({ connectionString: url }),
      // Emitted rather than printed, so every statement goes through the one
      // logger with the rest of the run (ADR-0008). Nothing is written unless
      // LOG_LEVEL is debug: the pipeline runs hundreds of statements per
      // package and they are noise until the moment they are the answer.
      log: [{ emit: 'event', level: 'query' }],
    });

    this.url = url;
    this.logger = logger.child({ scope: VerificationPrismaService.name });
  }

  async onModuleInit(): Promise<void> {
    this.$on('query', event => {
      this.logger.debug('SQL', {
        query: event.query,
        durationMs: event.duration,
      });
      // The parameters are the data itself — names, addresses, identity card
      // numbers off somebody's papers — so they are one level further down
      // than the statement that carried them, and never on by default.
      this.logger.verbose('SQL parameters', { params: event.params });
    });

    await this.$connect();

    this.logger.log('Connected to PostgreSQL', describe(this.url));
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
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
