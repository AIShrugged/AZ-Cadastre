import {
  Module,
  type DynamicModule,
  type MiddlewareConsumer,
  type ModuleMetadata,
  type NestModule,
  type Provider,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { AuthController } from './presentation/accounts/rest/index.js';
import {
  HttpExceptionFilter,
  RequestLoggingMiddleware,
  SystemExceptionFilter,
} from './presentation/http/index.js';
import {
  RolesGuard,
  SESSION_OPTIONS,
  SessionCodec,
  SessionGuard,
  type SessionOptions,
} from './presentation/http/session/index.js';
import {
  AddressesController,
  ArchiveSearchController,
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
  /**
   * How a session is signed and how long it lasts. The edge's own
   * configuration and not a context's: a session is how a browser carries the
   * answer to a sign-in from one request to the next, which is transport
   * (ADR-0029).
   *
   * A factory rather than a value, for the same reason every context takes one:
   * the composition root validates the environment once and hands out slices of
   * it, and the slice is not there until its config module is.
   */
  session: {
    inject?: unknown[];
    useFactory: (...args: never[]) => SessionOptions | Promise<SessionOptions>;
  };
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
        /*
         * Signing in, and the only routes on this API that may be reached
         * without a session. Everything else is refused 401 by `SessionGuard`
         * below, including a route nobody has written yet (ADR-0029).
         */
        AuthController,
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
        /*
         * The same area's third question, and the operator's own: not "what
         * does the archive say about this property" but "which of what the
         * archive holds might be this property". It is a door for the same
         * reason the other two are, and it is here rather than in the
         * verification context because a search is nobody's submission.
         */
        ArchiveSearchController,
        // The same area's other question: what the register holds at all,
        // rather than what it holds about one property. It is a door and not a
        // health check — whether the register process is up is a fact about
        // this deployment, and what it loaded is a fact the register publishes.
        RegistrySummaryController,
      ],
      providers: [
        ...options.providers,
        {
          provide: SESSION_OPTIONS,
          useFactory: options.session.useFactory,
          inject: (options.session.inject ?? []) as never[],
        },
        SessionCodec,
        /*
         * Two global guards, in this order and for two different questions.
         * `SessionGuard` answers "who is this" and refuses 401; `RolesGuard`
         * answers "may they" and refuses 403, reading the account the first one
         * put on the request. Nest runs global guards in registration order, so
         * the order here is the dependency between them.
         *
         * Global rather than per controller, because the rule is about the API
         * and not about one area of it: a controller added tomorrow is behind a
         * session because nobody did anything, and the way out of it is a
         * decorator on the route that a reviewer can see.
         */
        { provide: APP_GUARD, useClass: SessionGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
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
