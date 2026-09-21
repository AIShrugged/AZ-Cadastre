import { AccountRoleSchema } from '@cadastre/api-contracts/accounts';

import { InvalidAccountRoleException } from '../exceptions/index.js';

/**
 * The job an account holds: the office, or the applicant.
 *
 * The two values are the contract's own, read off `AccountRoleSchema` rather
 * than written again here. A second list would be a second place to add the
 * third role, and the one that got forgotten would fail at the boundary with
 * the enum's own name in the message and no clue which side was stale.
 */
export class AccountRole {
  static readonly OPERATOR = new AccountRole('operator');
  static readonly USER = new AccountRole('user');

  private constructor(public readonly value: 'operator' | 'user') {}

  static named(value: string): AccountRole {
    const parsed = AccountRoleSchema.safeParse(value);

    if (!parsed.success) {
      throw new InvalidAccountRoleException(value, AccountRoleSchema.options);
    }

    return parsed.data === 'operator' ? AccountRole.OPERATOR : AccountRole.USER;
  }

  get isOperator(): boolean {
    return this === AccountRole.OPERATOR;
  }

  equals(other: AccountRole): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
