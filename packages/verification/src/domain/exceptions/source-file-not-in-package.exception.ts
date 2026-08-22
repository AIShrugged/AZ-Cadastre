import { DomainException } from '@cadastre/shared';

export class SourceFileNotInPackageException extends DomainException {
  override readonly code = 'SOURCE_FILE_NOT_IN_PACKAGE';

  constructor(
    public readonly sourceFileId: string,
    public readonly packageId: string,
  ) {
    super(`Package ${packageId} has no source file ${sourceFileId}`);
  }
}
