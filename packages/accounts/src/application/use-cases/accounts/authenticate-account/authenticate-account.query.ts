import { Query } from '@nestjs/cqrs';

import type { AccountView } from '../../../read-models/index.js';

/**
 * A question and not a command: nothing about the account changes when somebody
 * signs in. What changes is what the browser is carrying afterwards, and that
 * is the edge's to write.
 */
export class AuthenticateAccountQuery extends Query<AccountView> {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {
    super();
  }
}
