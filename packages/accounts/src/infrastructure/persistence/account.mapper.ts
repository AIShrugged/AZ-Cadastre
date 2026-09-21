import { Account } from '../../domain/aggregates/index.js';
import {
  AccountId,
  AccountRole,
  Login,
  PasswordHash,
  PersonName,
} from '../../domain/value-objects/index.js';

import type { Account as AccountModel } from './generated/client.js';

/**
 * The row and the aggregate, mapped by hand in both directions.
 *
 * Explicit rather than generated, for the reason ADR-0004 gives: the table is
 * the persistence view of the model and not the model itself, and the moment
 * they are the same object the ORM starts deciding what a domain rule may say.
 */
export const AccountMapper = {
  toDomain(row: AccountModel): Account {
    return Account.restore({
      id: AccountId.of(row.id),
      version: row.version,
      login: Login.create(row.login),
      name: PersonName.create(row.firstName, row.lastName),
      role: AccountRole.named(row.role),
      passwordHash: PasswordHash.of(row.passwordHash),
    });
  },

  toRow(account: Account): {
    id: string;
    login: string;
    firstName: string;
    lastName: string;
    role: 'operator' | 'user';
    passwordHash: string;
    version: number;
  } {
    return {
      id: account.id.value,
      login: account.login.value,
      firstName: account.name.first,
      lastName: account.name.last,
      role: account.role.value,
      passwordHash: account.passwordHash.value,
      version: account.version,
    };
  },
};
