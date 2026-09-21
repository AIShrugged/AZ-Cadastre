import { describe, expect, it } from 'vitest';

import { InvalidAccountRoleException } from '../exceptions/index.js';

import { AccountRole } from './account-role.vo.js';

describe('AccountRole', () => {
  it('names the two the contract publishes', () => {
    expect(AccountRole.named('operator')).toBe(AccountRole.OPERATOR);
    expect(AccountRole.named('user')).toBe(AccountRole.USER);
  });

  it('knows which of them is the office', () => {
    expect(AccountRole.OPERATOR.isOperator).toBe(true);
    expect(AccountRole.USER.isOperator).toBe(false);
  });

  it.each(['admin', 'inspector', 'Operator', ''])(
    'refuses "%s" and says what it does name',
    value => {
      expect(() => AccountRole.named(value)).toThrow(
        InvalidAccountRoleException,
      );
      expect(() => AccountRole.named(value)).toThrow(/operator, user/);
    },
  );
});
