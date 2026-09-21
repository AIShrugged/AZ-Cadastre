import { AggregateRoot } from '@cadastre/shared';

import { AccountRegistered } from '../events/index.js';
import {
  AccountId,
  AccountRole,
  type Email,
  type FullName,
  type PasswordHash,
} from '../value-objects/index.js';

export type AccountState = {
  readonly id: AccountId;
  readonly version: number;
  readonly email: Email;
  readonly fullName: FullName;
  readonly role: AccountRole;
  readonly passwordHash: PasswordHash;
};

/**
 * Aggregate root: somebody who may use the system.
 *
 * Small on purpose. What an account is for is answering two questions — is this
 * person who they say they are, and what job do they hold — and everything else
 * a system eventually keeps about a person (a telephone number, a preferred
 * language, when they last signed in) is a different question that would drag
 * its own rules in with it.
 *
 * The password is never here, hashed or otherwise, except as the digest the
 * hasher produced: the aggregate cannot check a password and deliberately
 * cannot, because checking one is an algorithm with a cost parameter and a
 * native library behind it. It holds the digest; the use case asks the port
 * whether an offered password produces it.
 */
export class Account extends AggregateRoot<AccountId> {
  readonly #email: Email;
  readonly #fullName: FullName;
  readonly #role: AccountRole;
  readonly #passwordHash: PasswordHash;

  private constructor(state: AccountState) {
    super(state.id, state.version);
    this.#email = state.email;
    this.#fullName = state.fullName;
    this.#role = state.role;
    this.#passwordHash = state.passwordHash;
  }

  /**
   * Opens an account.
   *
   * The role is an argument and not a default, and the registration route is
   * what fixes it to `user`. The office's own accounts are made by the seed,
   * which is the one caller that passes `operator` — so "who may become an
   * operator" is a question with one answer and one place to read it, rather
   * than a flag on a request body that somebody has to remember to ignore.
   */
  static register(
    id: AccountId,
    email: Email,
    fullName: FullName,
    role: AccountRole,
    passwordHash: PasswordHash,
  ): Account {
    const account = new Account({
      id,
      version: 0,
      email,
      fullName,
      role,
      passwordHash,
    });

    account.apply(new AccountRegistered(id, email, role));

    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state);
  }

  get email(): Email {
    return this.#email;
  }

  get fullName(): FullName {
    return this.#fullName;
  }

  get role(): AccountRole {
    return this.#role;
  }

  get passwordHash(): PasswordHash {
    return this.#passwordHash;
  }
}
