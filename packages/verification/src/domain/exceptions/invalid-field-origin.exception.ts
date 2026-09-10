import { DomainException } from '@cadastre/shared';

export class InvalidFieldOriginException extends DomainException {
  override readonly code = 'INVALID_FIELD_ORIGIN';

  constructor(public readonly received: string) {
    super(`"${received}" is not an origin an extracted field can have`);
  }
}
