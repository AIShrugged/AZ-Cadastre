import type { AccountsApi } from '@cadastre/api-contracts/accounts';

/**
 * How the edge reaches the accounts context: the slice it actually calls, and
 * nothing more. Typed by the contracts package, bound in the composition root —
 * so making accounts a separate service changes the binding there and nothing
 * here.
 */
export abstract class AccountsClientPort {
  abstract readonly accounts: AccountsApi['accounts'];
}
