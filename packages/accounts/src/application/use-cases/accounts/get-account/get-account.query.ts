import { Query } from '@nestjs/cqrs';

import type { AccountView } from '../../../read-models/index.js';

/**
 * The account behind an id, or `null`. Answers `null` rather than refusing: the
 * caller is the edge holding a session, and an account that has gone since the
 * session was issued is a session to drop, not an error to serve.
 */
export class GetAccountQuery extends Query<AccountView | null> {
  constructor(public readonly accountId: string) {
    super();
  }
}
