import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  RegistryClientPort,
  VerificationClientPort,
} from '@cadastre/api-gateway';
import { Logger } from '@cadastre/logger';
import { VerificationApiPort } from '@cadastre/verification';

import type { Environment } from '../config/index.js';

import { HttpArchiveRegistryClient } from './registry/index.js';

/**
 * Every cross-boundary port binding in the system, and the only place any of
 * them is made.
 *
 * This file is the extraction seam. When a context becomes its own service,
 * `useExisting` becomes an RPC client here and nothing under `packages/` moves.
 * If extracting one would need a change anywhere else, the boundary is wrong.
 */
export const LOCAL_PROVIDERS: Provider[] = [
  // gateway → verification
  { provide: VerificationClientPort, useExisting: VerificationApiPort },
  /*
   * gateway → the archive register, which is not a context of ours and is
   * reached over HTTP because it is a system outside this one (ADR-0009). It
   * is the one binding here that is not `useExisting`: there is nothing in
   * this process to point at.
   */
  {
    provide: RegistryClientPort,
    inject: [ConfigService, Logger],
    useFactory: (config: ConfigService<Environment, true>, logger: Logger) =>
      new HttpArchiveRegistryClient(
        config.get('registry', { infer: true }),
        logger,
      ),
  },
];
