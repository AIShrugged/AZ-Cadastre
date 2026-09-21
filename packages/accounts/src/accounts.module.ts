import { Module, type DynamicModule } from '@nestjs/common';

import {
  ACCOUNTS_OPTIONS,
  type AccountsModuleAsyncOptions,
} from './accounts.module-defs.js';
import { AccountsApiPort } from './application/ports/index.js';
import { ACCOUNTS_APPLICATION_SERVICES } from './application/services/index.js';
import { ACCOUNTS_CQRS_HANDLERS } from './application/use-cases/index.js';
import { ACCOUNTS_INFRASTRUCTURE } from './infrastructure/index.js';

/**
 * The context's wiring, assembled from the provider arrays each layer exports.
 * Which adapter answers which port is decided next to the adapter, not here.
 *
 * Configuration arrives through `forRootAsync` as a typed slice: nothing under
 * `packages/` reads `process.env`.
 */
@Module({})
export class AccountsModule {
  static forRootAsync(options: AccountsModuleAsyncOptions): DynamicModule {
    return {
      module: AccountsModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: ACCOUNTS_OPTIONS,
          useFactory: options.useFactory,
          inject: (options.inject ?? []) as never[],
        },
        ...ACCOUNTS_CQRS_HANDLERS,
        ...ACCOUNTS_APPLICATION_SERVICES,
        ...ACCOUNTS_INFRASTRUCTURE,
      ],
      exports: [AccountsApiPort],
    };
  }
}
