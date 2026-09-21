import type { PasswordHash } from '../../../domain/value-objects/index.js';

/**
 * How a password becomes something safe to keep, and how an offered one is held
 * against what was kept.
 *
 * A port and not a domain service: which algorithm, at what cost, is a decision
 * about the machine this runs on and it changes without the model changing. It
 * is also where the constant-time comparison lives — a rule that `domain/`
 * could state but could not honour, because honouring it is the library's job.
 */
export abstract class PasswordHasher {
  /**
   * A digest no password produces, for holding an offered one against when no
   * account answers to the address.
   *
   * Without it a sign-in against an unknown address returns as fast as one
   * index read while a known one takes the hasher's whole cost, and a caller
   * with a stopwatch gets exactly the fact `InvalidCredentialsException` exists
   * to withhold. It is a property of the hasher because only the hasher knows
   * what one of its own digests costs to check.
   */
  abstract readonly unmatchableHash: PasswordHash;

  abstract hash(password: string): Promise<PasswordHash>;

  /**
   * Whether `password` is the one `hash` was made from.
   *
   * Answers `false` rather than raising where the stored digest is one this
   * hasher cannot read — a row written by an algorithm we no longer run is a
   * credential that no longer verifies, not a fault of the request.
   */
  abstract verify(hash: PasswordHash, password: string): Promise<boolean>;
}
