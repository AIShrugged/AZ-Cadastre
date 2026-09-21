import type { Account } from '../../domain/aggregates/index.js';

/**
 * An account as the context hands it out: the four things the contract
 * publishes, already flattened out of their value objects and carrying no
 * credential.
 *
 * A view and not the aggregate, for the reason the aggregate is not exported:
 * what leaves this context is a shape the contract names, and an aggregate that
 * travelled would take `passwordHash` with it.
 */
export type AccountView = {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: string;
};

export function toAccountView(account: Account): AccountView {
  return {
    id: account.id.value,
    email: account.email.value,
    fullName: account.fullName.value,
    role: account.role.value,
  };
}
