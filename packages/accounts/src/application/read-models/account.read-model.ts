import type { Account } from '../../domain/aggregates/index.js';

/**
 * An account as the context hands it out: the five things the contract
 * publishes, already flattened out of their value objects and carrying no
 * credential. The name comes out in its two parts, because that is the shape
 * the contract publishes — joining them is the client's decision.
 *
 * A view and not the aggregate, for the reason the aggregate is not exported:
 * what leaves this context is a shape the contract names, and an aggregate that
 * travelled would take `passwordHash` with it.
 */
export type AccountView = {
  readonly id: string;
  readonly login: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: string;
};

export function toAccountView(account: Account): AccountView {
  return {
    id: account.id.value,
    login: account.login.value,
    firstName: account.name.first,
    lastName: account.name.last,
    role: account.role.value,
  };
}
