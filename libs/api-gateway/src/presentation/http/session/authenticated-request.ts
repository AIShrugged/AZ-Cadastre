import type { Request } from 'express';

import type { AccountDto } from '@cadastre/api-contracts/accounts';

/**
 * The request once `SessionGuard` has said who is making it.
 *
 * A property on the request rather than a global module augmentation of
 * Express: an augmentation would make `request.account` appear — optional and
 * usually `undefined` — on every handler in the repository, including the ones
 * no guard has run in front of.
 */
export type AuthenticatedRequest = Request & { account?: AccountDto };

/** Whoever the session named, or `undefined` on a route that allows anonymity. */
export function accountOf(request: Request): AccountDto | undefined {
  return (request as AuthenticatedRequest).account;
}

export function attachAccount(request: Request, account: AccountDto): void {
  (request as AuthenticatedRequest).account = account;
}
