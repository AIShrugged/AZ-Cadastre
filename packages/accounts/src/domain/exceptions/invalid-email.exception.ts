import { DomainException } from '@cadastre/shared';

export class InvalidEmailException extends DomainException {
  override readonly code = 'INVALID_EMAIL';

  constructor(reason: string) {
    super(`Not an email address: ${reason}`);
  }
}
