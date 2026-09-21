import { InvalidPasswordHashException } from '../exceptions/index.js';

/**
 * What is kept instead of a password.
 *
 * It is a value and not a string so that the type system says where a
 * credential is: a `string` flows into a log line, a DTO or a template without
 * anybody noticing, and this does not — it has no `toJSON`, and its `toString`
 * says what it is rather than what it holds. The only way to read the digest
 * out is `value`, which the repository uses and nothing else does.
 *
 * The context never computes one: hashing is a cost parameter, an algorithm and
 * a native library, which is infrastructure. The domain holds the result and
 * the port beside it does the work.
 */
export class PasswordHash {
  private constructor(public readonly value: string) {}

  static of(digest: string): PasswordHash {
    if (digest.trim() === '') throw new InvalidPasswordHashException();

    return new PasswordHash(digest);
  }

  /** So a hash cannot reach a log line by being interpolated into one. */
  toString(): string {
    return '[password hash]';
  }

  toJSON(): string {
    return '[password hash]';
  }
}
