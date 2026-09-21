import { describe, expect, it } from 'vitest';

import type { AccountDto } from '@cadastre/api-contracts/accounts';

import { scopeFor } from './package-scope.js';

const ID = '11111111-1111-4111-8111-111111111111';

function account(role: AccountDto['role']): AccountDto {
  return { id: ID, login: 'somebody', firstName: 'A', lastName: 'B', role };
}

describe('scopeFor', () => {
  it('scopes the office to nothing, which is every submission', () => {
    expect(scopeFor(account('operator'))).toBeNull();
  });

  it('scopes an applicant to their own account', () => {
    expect(scopeFor(account('user'))).toEqual({ ownerAccountId: ID });
  });
});
