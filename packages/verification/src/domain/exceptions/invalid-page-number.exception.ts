import { DomainException } from '@cadastre/shared';

export class InvalidPageNumberException extends DomainException {
  override readonly code = 'INVALID_PAGE_NUMBER';

  constructor(public readonly received: number) {
    super(`A page number must be a positive integer, received ${received}`);
  }
}
