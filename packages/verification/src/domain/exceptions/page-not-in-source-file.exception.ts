import { DomainException } from '@cadastre/shared';

export class PageNotInSourceFileException extends DomainException {
  override readonly code = 'PAGE_NOT_IN_SOURCE_FILE';

  constructor(
    public readonly pageId: string,
    public readonly sourceFileId: string,
  ) {
    super(`Source file ${sourceFileId} has no page ${pageId}`);
  }
}
