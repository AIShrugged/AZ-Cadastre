import { DomainException } from '@cadastre/shared';

export class InvalidPersonNameException extends DomainException {
  override readonly code = 'INVALID_PERSON_NAME';

  constructor(part: 'first name' | 'last name', reason: string) {
    super(`Not a ${part}: ${reason}`);
  }
}
