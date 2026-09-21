import { DomainEvent } from '@cadastre/shared';

import type { AccountId, AccountRole, Email } from '../value-objects/index.js';

/**
 * An account was opened. Carries the address and the role, and never the
 * credential — an event is the thing most likely to end up in a log.
 */
export class AccountRegistered extends DomainEvent {
  override readonly type = 'accounts.AccountRegistered';

  constructor(
    public readonly accountId: AccountId,
    public readonly email: Email,
    public readonly role: AccountRole,
  ) {
    super();
  }
}
