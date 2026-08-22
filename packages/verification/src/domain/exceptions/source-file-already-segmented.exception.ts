import { DomainException } from '@cadastre/shared';

export class SourceFileAlreadySegmentedException extends DomainException {
  override readonly code = 'SOURCE_FILE_ALREADY_SEGMENTED';

  constructor(public readonly sourceFileId: string) {
    super(
      `Source file ${sourceFileId} has already been read into its documents`,
    );
  }
}
