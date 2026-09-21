import { DomainEvent } from '@cadastre/shared';

import type { AccountId, AccountRole, Login } from '../value-objects/index.js';

/**
 * An account was opened. Carries the login and the role, and never the
 * credential — an event is the thing most likely to end up in a log, and a
 * login is a name where a password is a secret.
 */
export class AccountRegistered extends DomainEvent {
  override readonly type = 'accounts.AccountRegistered';

  constructor(
    public readonly accountId: AccountId,
    public readonly login: Login,
    public readonly role: AccountRole,
  ) {
    super();
  }
}
