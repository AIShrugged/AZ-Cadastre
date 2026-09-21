import {
  LOGIN_MAX_LENGTH,
  LOGIN_MIN_LENGTH,
} from '@cadastre/api-contracts/accounts';

import { InvalidLoginException } from '../exceptions/index.js';

/**
 * The name an account answers to, and the only thing it is found by.
 *
 * A plain string and deliberately not an address. The office's own account is
 * `cadastre-operator`; an applicant will probably type their email in, and that
 * is fine — it is stored and compared as the characters they typed. Nothing
 * here asks whether mail would reach it, because nothing in this system sends
 * any, and a validator that refused `cadastre-operator` would refuse the one
 * login the product ships with.
 *
 * Held folded to lower case, because that is what makes "already taken" mean
 * what a person expects: `Aysel` and `aysel` are one login, and storing both
 * would let the same person open two accounts and then fail to sign in to the
 * one they meant.
 *
 * The bounds are the contract's own, and they are the whole rule — three to
 * sixty-four characters, folded, and nothing else asked about them. Deliberate:
 * a rule the registration schema does not also enforce is a request the edge
 * accepts and this refuses, which comes out as a 422 nobody wrote down.
 */
export class Login {
  private constructor(public readonly value: string) {}

  static create(raw: string): Login {
    const folded = raw.trim().toLowerCase();

    if (folded === '') throw new InvalidLoginException('it is empty');
    if (folded.length < LOGIN_MIN_LENGTH) {
      throw new InvalidLoginException(
        `shorter than ${LOGIN_MIN_LENGTH} characters`,
      );
    }
    if (folded.length > LOGIN_MAX_LENGTH) {
      throw new InvalidLoginException(
        `longer than ${LOGIN_MAX_LENGTH} characters`,
      );
    }
    return new Login(folded);
  }

  /**
   * The same rule, answering `null` instead of raising.
   *
   * For the one caller that must not tell a malformed login from a wrong
   * password: a sign-in answers 401 to both, so it cannot let a refusal escape
   * from here.
   */
  static safe(raw: string): Login | null {
    try {
      return Login.create(raw);
    } catch {
      return null;
    }
  }

  equals(other: Login): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
