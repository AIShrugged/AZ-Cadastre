import type { Provider } from '@nestjs/common';

import { CqrsDomainEventPublisher } from '@cadastre/event-publisher';
import { DomainEventPublisher } from '@cadastre/shared';

import { VERIFICATION_ADAPTERS } from './adapters/index.js';
import { VERIFICATION_IDENTITY } from './identity/index.js';
import { VERIFICATION_PERSISTENCE } from './persistence/index.js';

/**
 * Everything the context needs from the outside world, bound to the ports that
 * name it. Domain events go over the in-process CQRS bus: they never leave this
 * context, so a broker would buy nothing but a hop (ADR-0001).
 */
export const VERIFICATION_INFRASTRUCTURE: Provider[] = [
  ...VERIFICATION_PERSISTENCE,
  ...VERIFICATION_ADAPTERS,
  ...VERIFICATION_IDENTITY,
  { provide: DomainEventPublisher, useClass: CqrsDomainEventPublisher },
];
