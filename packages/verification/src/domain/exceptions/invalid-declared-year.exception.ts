import { DomainException } from '@cadastre/shared';

export class InvalidDeclaredYearException extends DomainException {
  override readonly code = 'INVALID_DECLARED_YEAR';

  constructor(public readonly year: number) {
    super(`"${year}" is not a year a building can be declared built in`);
  }
}
