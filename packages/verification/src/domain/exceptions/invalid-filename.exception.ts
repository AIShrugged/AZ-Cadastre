import { DomainException } from '@cadastre/shared';

export class InvalidFilenameException extends DomainException {
  override readonly code = 'INVALID_FILENAME';

  constructor(public readonly reason: 'empty' | 'too_long') {
    super(`A file name must not be ${reason.replace('_', ' ')}`);
  }
}
