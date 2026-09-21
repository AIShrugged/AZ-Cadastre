import { DomainException } from '@cadastre/shared';

export class InvalidLoginException extends DomainException {
  override readonly code = 'INVALID_LOGIN';

  constructor(reason: string) {
    super(`Not a login: ${reason}`);
  }
}
