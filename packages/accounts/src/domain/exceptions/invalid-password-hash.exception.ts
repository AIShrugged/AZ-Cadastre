import { DomainException } from '@cadastre/shared';

/**
 * Raised where a row carries something that is not a hash at all — an empty
 * column, a plaintext password somebody wrote in by hand. Never raised on a
 * hash that simply does not match: that is an answer, not a fault.
 */
export class InvalidPasswordHashException extends DomainException {
  override readonly code = 'INVALID_PASSWORD_HASH';

  constructor() {
    // Deliberately says nothing about what arrived: the value is a credential,
    // and an exception message is a thing that gets logged.
    super('An account was restored with no usable password hash');
  }
}
