import type { Provider } from '@nestjs/common';

import { AccountRepository } from '../../application/ports/outbound/index.js';

import { AccountRepositoryAdapter } from './account-repository.adapter.js';
import { AccountsPrismaService } from './accounts-prisma.service.js';

export { AccountMapper } from './account.mapper.js';
export { AccountRepositoryAdapter } from './account-repository.adapter.js';
export { AccountsPrismaService } from './accounts-prisma.service.js';

/**
 * The persistence half of the context, bound to the port it implements. The
 * binding lives here rather than in the module so that adding an adapter is one
 * file and its neighbour, not one file and a trip to the wiring.
 */
export const ACCOUNTS_PERSISTENCE: Provider[] = [
  AccountsPrismaService,
  { provide: AccountRepository, useClass: AccountRepositoryAdapter },
];
