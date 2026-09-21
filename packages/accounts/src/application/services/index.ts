import type { Provider } from '@nestjs/common';

import { AccountsApiPort } from '../ports/inbound/index.js';

import { AccountDirectoryService } from './account-directory.service.js';
import { AccountsService } from './accounts.service.js';

export { AccountDirectoryService } from './account-directory.service.js';
export { AccountsService } from './accounts.service.js';

/**
 * The façade services and the inbound port they add up to. `AccountsService` is
 * bound rather than listed: the port is what the module exports and what the
 * composition root binds the gateway's client port to.
 */
export const ACCOUNTS_APPLICATION_SERVICES: Provider[] = [
  AccountDirectoryService,
  { provide: AccountsApiPort, useClass: AccountsService },
];
