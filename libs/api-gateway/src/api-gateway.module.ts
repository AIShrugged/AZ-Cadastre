import {
  Module,
  type DynamicModule,
  type ModuleMetadata,
  type Provider,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import {
  DocumentsController,
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
        { provide: APP_FILTER, useClass: VerificationExceptionFilter },
      ],
    };
  }
}
