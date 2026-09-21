import { describe, expect, it } from 'vitest';

import { AccountRegistered } from '../events/index.js';
import {
  AccountId,
  AccountRole,
  Email,
  FullName,
  PasswordHash,
} from '../value-objects/index.js';

import { Account } from './account.aggregate.js';

const ID = AccountId.of('11111111-1111-4111-8111-111111111111');

function anAccount(role: AccountRole = AccountRole.USER): Account {
  return Account.register(
    ID,
    Email.create('Applicant@Cadastre.AZ'),
    FullName.create('  Rəşad   Məmmədov '),
    role,
    PasswordHash.of('$argon2id$v=19$digest'),
  );
}

describe('Account', () => {
  it('holds the address folded and the name tidied', () => {
    const account = anAccount();

    expect(account.email.value).toBe('applicant@cadastre.az');
    expect(account.fullName.value).toBe('Rəşad Məmmədov');
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
      email: Email.create('a@b.az'),
      fullName: FullName.create('A B'),
      role: AccountRole.OPERATOR,
      passwordHash: PasswordHash.of('$argon2id$v=19$digest'),
    });

    expect(restored.version).toBe(4);
    expect(restored.getUncommittedEvents()).toEqual([]);
  });
});
