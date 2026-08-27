import type { Provider } from '@nestjs/common';

import { RegistrySource } from '../application/ports/index.js';

import {
  PrismaRegistrySourceAdapter,
  RegistryPrismaService,
} from './persistence/index.js';

export {
  PrismaRegistrySourceAdapter,
  RegistryPrismaService,
} from './persistence/index.js';

/**
 * The one binding this service has. The records come out of the register's own
 * database — seeded today with the cases the customer supplied, loaded from the
 * ingested register files tomorrow, and answered by a real state register the
 * day one exists. Which of those is behind it is this line and nothing above it
 * (ADR-0009, ADR-0010).
 */
export const REGISTRY_INFRASTRUCTURE: Provider[] = [
  RegistryPrismaService,
  { provide: RegistrySource, useClass: PrismaRegistrySourceAdapter },
];
