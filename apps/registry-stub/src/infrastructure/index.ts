import type { Provider } from '@nestjs/common';

import { RegistrySource } from '../application/ports/index.js';

import { FixtureRegistrySourceAdapter } from './fixture-registry-source.adapter.js';

export { FixtureRegistrySourceAdapter } from './fixture-registry-source.adapter.js';

/**
 * The one binding this service has. When the register files are ingested for
 * real, a second adapter is added here and chosen by configuration — the way
 * every other provider in this repository is chosen — and nothing above this
 * line changes.
 */
export const REGISTRY_INFRASTRUCTURE: Provider[] = [
  { provide: RegistrySource, useClass: FixtureRegistrySourceAdapter },
];
