import { DomainException } from '@cadastre/shared';

export class SourceFileMustHaveAPageException extends DomainException {
  override readonly code = 'SOURCE_FILE_MUST_HAVE_A_PAGE';

  constructor(public readonly sourceFileId: string) {
    super(`Source file ${sourceFileId} cannot be split into no pages at all`);
  }
}
