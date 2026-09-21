import { AggregateRoot } from '@cadastre/shared';

import { AccountRegistered } from '../events/index.js';
import {
  AccountId,
  AccountRole,
  type Login,
  type PasswordHash,
  type PersonName,
} from '../value-objects/index.js';

export type AccountState = {
  readonly id: AccountId;
  readonly version: number;
  readonly login: Login;
  readonly name: PersonName;
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
  readonly #login: Login;
  readonly #name: PersonName;
  readonly #role: AccountRole;
  readonly #passwordHash: PasswordHash;

  private constructor(state: AccountState) {
    super(state.id, state.version);
    this.#login = state.login;
    this.#name = state.name;
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
    login: Login,
    name: PersonName,
    role: AccountRole,
    passwordHash: PasswordHash,
  ): Account {
    const account = new Account({
      id,
      version: 0,
      login,
      name,
      role,
      passwordHash,
    });

    account.apply(new AccountRegistered(id, login, role));

    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state);
  }

  get login(): Login {
    return this.#login;
  }

  get name(): PersonName {
    return this.#name;
  }

  get role(): AccountRole {
    return this.#role;
  }

  get passwordHash(): PasswordHash {
    return this.#passwordHash;
  }
}
