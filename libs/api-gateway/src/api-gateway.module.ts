import {
  Module,
  type DynamicModule,
  type MiddlewareConsumer,
  type ModuleMetadata,
  type NestModule,
  type Provider,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import {
  HttpExceptionFilter,
  RequestLoggingMiddleware,
  SystemExceptionFilter,
} from './presentation/http/index.js';
import {
  AddressesController,
  RegistrySummaryController,
} from './presentation/registry/rest/index.js';
import {
  DocumentsController,
  PackagesController,
  ProfilesController,
} from './presentation/verification/rest/index.js';

export type ApiGatewayModuleOptions = Pick<ModuleMetadata, 'imports'> & {
  /**
   * The client-port bindings, handed in by the composition root. The gateway
   * declares what it needs and never names who satisfies it.
   */
  providers: Provider[];
};

@Module({})
export class ApiGatewayModule implements NestModule {
  // Every request, with the status it was answered with and how long it took
  // (ADR-0008). The edge is where a request exists at all, so it is where the
  // access log is written — and over every path, including the ones no
  // controller claims. `{*path}` is the Express 5 spelling of "everything"; a
  // bare `*` is a parse error there, not a wildcard.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('{*path}');
  }

  static forRoot(options: ApiGatewayModuleOptions): DynamicModule {
    return {
      module: ApiGatewayModule,
      imports: options.imports ?? [],
      controllers: [
        DocumentsController,
        PackagesController,
        ProfilesController,
        /*
         * The archive register's area. It is not a context of ours and it is
         * not reached through one (ADR-0009) — the route exists so that the
         * browser reaches a published contract at this system's origin instead
         * of going round the API to a register with nothing in front of it
         * (TECH_DEBT §10).
         */
        AddressesController,
        // The same area's other question: what the register holds at all,
        // rather than what it holds about one property. It is a door and not a
        // health check — whether the register process is up is a fact about
        // this deployment, and what it loaded is a fact the register publishes.
        RegistrySummaryController,
      ],
      providers: [
        ...options.providers,
        // The transport is where a refusal becomes a status code, so the
        // `code → status` table lives at the edge and not in the context that
        // raised it.
        /*
         * Order matters, and it is the reverse of the listing: Nest applies
         * APP_FILTER providers last-registered-first, so the filter over our
         * own exception bases must come after the framework one to get first
         * refusal. Both render the contract's ErrorBody — the published
         * language has one error shape and the API must not have two.
         */
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_FILTER, useClass: SystemExceptionFilter },
        RequestLoggingMiddleware,
      ],
    };
  }
}
