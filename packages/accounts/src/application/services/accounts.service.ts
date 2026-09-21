import { Injectable } from '@nestjs/common';

import { AccountsApiPort } from '../ports/inbound/index.js';

import { AccountDirectoryService } from './account-directory.service.js';

/**
 * The only class in the context that knows the whole API surface. One area
 * today, and the façade stays because the port is what the module exports:
 * adding a second area is then a constructor parameter and not a new shape.
 */
@Injectable()
export class AccountsService extends AccountsApiPort {
  constructor(readonly accounts: AccountDirectoryService) {
    super();
  }
}
