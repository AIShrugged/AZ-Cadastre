import { DomainException } from '@cadastre/shared';

export class DocumentNotInPackageException extends DomainException {
  override readonly code = 'DOCUMENT_NOT_IN_PACKAGE';

  constructor(
    public readonly documentId: string,
    public readonly packageId: string,
  ) {
    super(`Package ${packageId} has no document ${documentId}`);
  }
}
