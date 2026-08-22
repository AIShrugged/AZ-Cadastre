import { DomainException } from '@cadastre/shared';

export class InvalidFieldKeyException extends DomainException {
  override readonly code = 'INVALID_FIELD_KEY';

  constructor(public readonly reason: 'empty' | 'too_long') {
    super(`A field key must not be ${reason.replace('_', ' ')}`);
  }
}
