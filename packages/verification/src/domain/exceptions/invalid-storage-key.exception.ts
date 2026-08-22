import { DomainException } from '@cadastre/shared';

export class InvalidStorageKeyException extends DomainException {
  override readonly code = 'INVALID_STORAGE_KEY';

  constructor(public readonly reason: 'empty' | 'too_long') {
    super(`A storage key must not be ${reason.replace('_', ' ')}`);
  }
}
