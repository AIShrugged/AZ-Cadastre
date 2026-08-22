import { DomainException } from '@cadastre/shared';

export class SourceFileNotSplitException extends DomainException {
  override readonly code = 'SOURCE_FILE_NOT_SPLIT';

  constructor(public readonly sourceFileId: string) {
    super(
      `Source file ${sourceFileId} has no pages yet, so it holds no documents`,
    );
  }
}
