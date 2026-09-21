import type { Provider } from '@nestjs/common';

import { IdGenerator } from '../../application/ports/outbound/index.js';

import { UuidIdGenerator } from './uuid-id-generator.adapter.js';

export { UuidIdGenerator } from './uuid-id-generator.adapter.js';

export const ACCOUNTS_IDENTITY: Provider[] = [
  { provide: IdGenerator, useClass: UuidIdGenerator },
];
