import { describe, expect, it } from 'vitest';

import { AccountRegistered } from '../events/index.js';
import {
  AccountId,
  AccountRole,
  Login,
  PasswordHash,
  PersonName,
} from '../value-objects/index.js';

import { Account } from './account.aggregate.js';

const ID = AccountId.of('11111111-1111-4111-8111-111111111111');

function anAccount(role: AccountRole = AccountRole.USER): Account {
  return Account.register(
    ID,
    Login.create('Cadastre-Applicant'),
    PersonName.create('  Rəşad ', ' Məmmədov  '),
    role,
    PasswordHash.of('$argon2id$v=19$digest'),
  );
}

describe('Account', () => {
  it('holds the login folded and each name part tidied', () => {
    const account = anAccount();

    expect(account.login.value).toBe('cadastre-applicant');
    expect(account.name.first).toBe('Rəşad');
    expect(account.name.last).toBe('Məmmədov');
  });

  it('raises AccountRegistered carrying no credential', () => {
    const [event] = anAccount().getUncommittedEvents();

    expect(event).toBeInstanceOf(AccountRegistered);
    expect(JSON.stringify(event)).not.toContain('digest');
  });

  it('takes the role from the caller, so the registration route decides it', () => {
    expect(anAccount(AccountRole.OPERATOR).role.isOperator).toBe(true);
    expect(anAccount(AccountRole.USER).role.isOperator).toBe(false);
  });

  it('restores from a row without raising anything', () => {
    const restored = Account.restore({
      id: ID,
      version: 4,
      login: Login.create('somebody'),
      name: PersonName.create('A', 'B'),
      role: AccountRole.OPERATOR,
      passwordHash: PasswordHash.of('$argon2id$v=19$digest'),
    });

    expect(restored.version).toBe(4);
    expect(restored.getUncommittedEvents()).toEqual([]);
  });
});
