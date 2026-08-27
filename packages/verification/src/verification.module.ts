import { Module, type DynamicModule } from '@nestjs/common';

import { VERIFICATION_EVENT_HANDLERS } from './application/event-handlers/index.js';
import { VerificationApiPort } from './application/ports/index.js';
import { VERIFICATION_APPLICATION_SERVICES } from './application/services/index.js';
import { VERIFICATION_CQRS_HANDLERS } from './application/use-cases/index.js';
import { VERIFICATION_INFRASTRUCTURE } from './infrastructure/index.js';
import {
  VERIFICATION_OPTIONS,
  type VerificationModuleAsyncOptions,
} from './verification.module-defs.js';

/**
 * The context's wiring, assembled from the provider arrays each layer exports.
 * Which adapter answers which port is decided next to the adapter, not here —
 * so this file changes when the context gains a layer, not when it gains a
 * class.
 *
 * Configuration arrives through `forRootAsync` as a typed slice: nothing under
 * `packages/` reads `process.env`, so the same context runs under a different
 * root without changing.
 */
@Module({})
export class VerificationModule {
  static forRootAsync(options: VerificationModuleAsyncOptions): DynamicModule {
    return {
      module: VerificationModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: VERIFICATION_OPTIONS,
          useFactory: options.useFactory,
          inject: (options.inject ?? []) as never[],
        },
        ...VERIFICATION_CQRS_HANDLERS,
        ...VERIFICATION_EVENT_HANDLERS,
        ...VERIFICATION_APPLICATION_SERVICES,
        ...VERIFICATION_INFRASTRUCTURE,
      ],
      exports: [VerificationApiPort],
    };
  }
}
