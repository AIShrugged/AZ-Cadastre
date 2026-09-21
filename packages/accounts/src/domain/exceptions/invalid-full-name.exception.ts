import { DomainException } from '@cadastre/shared';

export class InvalidFullNameException extends DomainException {
  override readonly code = 'INVALID_FULL_NAME';

  constructor(reason: string) {
    super(`Not a name: ${reason}`);
  }
}
