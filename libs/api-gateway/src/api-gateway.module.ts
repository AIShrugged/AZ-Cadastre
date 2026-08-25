import {
  Module,
  type DynamicModule,
  type ModuleMetadata,
  type Provider,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { RequestLoggingInterceptor } from './presentation/http/index.js';
import {
  DocumentsController,
  HttpExceptionFilter,
  PackagesController,
  ProfilesController,
  VerificationExceptionFilter,
} from './presentation/verification/rest/index.js';

export type ApiGatewayModuleOptions = Pick<ModuleMetadata, 'imports'> & {
  /**
   * The client-port bindings, handed in by the composition root. The gateway
   * declares what it needs and never names who satisfies it.
   */
  providers: Provider[];
};

@Module({})
export class ApiGatewayModule {
  static forRoot(options: ApiGatewayModuleOptions): DynamicModule {
    return {
      module: ApiGatewayModule,
      imports: options.imports ?? [],
      controllers: [
        DocumentsController,
        PackagesController,
        ProfilesController,
      ],
      providers: [
        ...options.providers,
        // The transport is where a refusal becomes a status code, so the
        // `code → status` table lives at the edge and not in the context that
        // raised it.
        /*
         * Order matters, and it is the reverse of the listing: Nest applies
         * APP_FILTER providers last-registered-first, so the domain filter must
         * come after the framework one to get first refusal. Both render the
         * contract's ErrorBody — the published language has one error shape and
         * the API must not have two.
         */
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_FILTER, useClass: VerificationExceptionFilter },
        // Every request that reached a route, with the status it was answered
        // with and how long it took (ADR-0008). The edge is where a request
        // exists at all, so it is where the access log is written.
        { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
      ],
    };
  }
}
