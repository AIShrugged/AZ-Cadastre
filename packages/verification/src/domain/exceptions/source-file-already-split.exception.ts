import { DomainException } from '@cadastre/shared';

export class SourceFileAlreadySplitException extends DomainException {
  override readonly code = 'SOURCE_FILE_ALREADY_SPLIT';

  constructor(public readonly sourceFileId: string) {
    super(`Source file ${sourceFileId} has already been split into pages`);
  }
}
