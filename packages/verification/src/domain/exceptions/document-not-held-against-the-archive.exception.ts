import { DomainException } from '@cadastre/shared';

export class DocumentNotHeldAgainstTheArchiveException extends DomainException {
  override readonly code = 'DOCUMENT_NOT_HELD_AGAINST_THE_ARCHIVE';

  constructor(
    public readonly documentId: string,
    public readonly documentType: string | null,
  ) {
    super(
      `Document ${documentId} (${documentType ?? 'unclassified'}) is not a ` +
        'paper the profile holds against the National Archive by its QR code',
    );
  }
}
