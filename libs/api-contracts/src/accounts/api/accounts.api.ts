import type { AccountDirectoryApi } from './account-directory.api.js';

/**
 * The whole published surface of the accounts context, by area. One area today:
 * a context with one language does not need two.
 */
export interface AccountsApi {
  readonly accounts: AccountDirectoryApi;
}
