import { DomainException } from '@cadastre/shared';

export class DocumentsMustCoverEverySheetException extends DomainException {
  override readonly code = 'DOCUMENTS_MUST_COVER_EVERY_SHEET';

  constructor(
    public readonly sourceFileId: string,
    public readonly pageCount: number,
  ) {
    super(
      `The documents found in source file ${sourceFileId} must together cover ` +
        `its ${pageCount} page(s) once each, back to back`,
    );
  }
}
