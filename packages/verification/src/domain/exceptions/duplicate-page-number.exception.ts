import { DomainException } from '@cadastre/shared';

export class DuplicatePageNumberException extends DomainException {
  override readonly code = 'DUPLICATE_PAGE_NUMBER';

  constructor(
    public readonly sourceFileId: string,
    public readonly pageNumber: number,
  ) {
    super(`Source file ${sourceFileId} already has a page ${pageNumber}`);
  }
}
