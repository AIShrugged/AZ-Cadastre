import type { AccountsApi } from '@cadastre/api-contracts/accounts';

/**
 * What this context offers, as a DI token. An abstract class rather than an
 * interface because the composition root has to bind a runtime value, and it
 * mirrors the contract interface so the compiler keeps the two honest.
 */
export abstract class AccountsApiPort implements AccountsApi {
  abstract readonly accounts: AccountsApi['accounts'];
}
