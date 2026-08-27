import { DomainException } from '@cadastre/shared';

export class SourceFileMustHaveADocumentException extends DomainException {
  override readonly code = 'SOURCE_FILE_MUST_HAVE_A_DOCUMENT';

  constructor(public readonly sourceFileId: string) {
    super(`Source file ${sourceFileId} must hold at least one document`);
  }
}
