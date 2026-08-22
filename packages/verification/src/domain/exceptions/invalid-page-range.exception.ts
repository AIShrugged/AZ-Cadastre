import { DomainException } from '@cadastre/shared';

export class InvalidPageRangeException extends DomainException {
  override readonly code = 'INVALID_PAGE_RANGE';

  constructor(
    public readonly first: number,
    public readonly last: number,
  ) {
    super(`A page range cannot end before it starts: ${first}–${last}`);
  }
}
