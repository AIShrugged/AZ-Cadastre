import { InvalidEmailException } from '../exceptions/index.js';

// Long enough for anything a person actually has, short enough that the column
// and the uniqueness index are bounded.
const MAX_LENGTH = 254;

/**
 * The address an account answers to, and the only thing it is found by.
 *
 * Held folded to lower case, because that is what makes "already taken" mean
 * what a person expects: two addresses differing only in case are one address
 * to every mail server there is, and storing both would let the same person
 * open two accounts and then fail to sign in to the one they meant.
 *
 * The shape check is deliberately shallow — an `@` with something either side
 * of it and no spaces. Anything stricter is a rule about which addresses exist,
 * and that rule is wrong: the grammar in the RFC admits addresses no validator
 * in the wild accepts, and the only test that settles it is sending mail, which
 * this system does not do.
 */
export class Email {
  private constructor(public readonly value: string) {}

  static create(raw: string): Email {
    const folded = raw.trim().toLowerCase();

    if (folded === '') throw new InvalidEmailException('it is empty');
    if (folded.length > MAX_LENGTH) {
      throw new InvalidEmailException(`longer than ${MAX_LENGTH} characters`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(folded)) {
      throw new InvalidEmailException('no name, @ and domain');
    }

    return new Email(folded);
  }

  /**
   * The same rule, answering `null` instead of raising.
   *
   * For the one caller that must not tell a malformed address from a wrong
   * password: a sign-in answers 401 to both, so it cannot let a refusal escape
   * from here.
   */
  static safe(raw: string): Email | null {
    try {
      return Email.create(raw);
    } catch {
      return null;
    }
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
