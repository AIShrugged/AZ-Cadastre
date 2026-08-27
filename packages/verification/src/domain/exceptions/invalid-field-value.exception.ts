import { DomainException } from '@cadastre/shared';

export class InvalidFieldValueException extends DomainException {
  override readonly code = 'INVALID_FIELD_VALUE';

  constructor(public readonly reason: 'empty' | 'too_long') {
    super(`An extracted field value must not be ${reason.replace('_', ' ')}`);
  }
}
