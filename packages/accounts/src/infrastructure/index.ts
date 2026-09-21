import type { Provider } from '@nestjs/common';

import { CqrsDomainEventPublisher } from '@cadastre/event-publisher';
import { DomainEventPublisher } from '@cadastre/shared';

import { ACCOUNTS_IDENTITY } from './identity/index.js';
import { ACCOUNTS_PERSISTENCE } from './persistence/index.js';
import { ACCOUNTS_SECURITY } from './security/index.js';
import { ACCOUNTS_SEED } from './seed/index.js';

/**
 * Everything the context needs from the outside world, bound to the ports that
 * name it.
 */
export const ACCOUNTS_INFRASTRUCTURE: Provider[] = [
  ...ACCOUNTS_PERSISTENCE,
  ...ACCOUNTS_IDENTITY,
  ...ACCOUNTS_SECURITY,
  ...ACCOUNTS_SEED,
  { provide: DomainEventPublisher, useClass: CqrsDomainEventPublisher },
];
