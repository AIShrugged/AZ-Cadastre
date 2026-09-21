import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { Logger } from '@cadastre/logger';

import {
  ACCOUNTS_OPTIONS,
  type AccountsModuleOptions,
} from '../../accounts.module-defs.js';

import { PrismaClient } from './generated/client.js';

/**
 * The generated client is generic in the events it emits, and `class X extends
 * PrismaClient` instantiates that generic with its default — `never` — so
 * `$on('query')` does not typecheck however the constructor is configured.
 */
const QueryEmittingPrismaClient = PrismaClient as unknown as new (
  options: ConstructorParameters<typeof PrismaClient>[0],
) => PrismaClient<'query'>;

@Injectable()
export class AccountsPrismaService
  extends QueryEmittingPrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger: Logger;
  private readonly url: string;

  constructor(
    @Inject(ACCOUNTS_OPTIONS) options: AccountsModuleOptions,
    @Inject(Logger) logger: Logger,
  ) {
    const { url } = options.database;

    super({
      adapter: new PrismaPg({ connectionString: url }),
      log: [{ emit: 'event', level: 'query' }],
    });

    this.url = url;
    this.logger = logger.child({ scope: AccountsPrismaService.name });
  }

  async onModuleInit(): Promise<void> {
    this.$on('query', event => {
      this.logger.debug('SQL', {
        query: event.query,
        durationMs: event.duration,
      });
      /*
       * One level further down than the statement, and never on by default —
       * and here that matters more than it does next door: the parameters of a
       * sign-in are somebody's address, and of a registration, the digest of
       * their password.
       */
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
