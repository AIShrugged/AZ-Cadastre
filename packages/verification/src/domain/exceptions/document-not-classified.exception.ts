import { DomainException } from '@cadastre/shared';

export class DocumentNotClassifiedException extends DomainException {
  override readonly code = 'DOCUMENT_NOT_CLASSIFIED';

  constructor(public readonly documentId: string) {
    super(
      `Document ${documentId} must be classified before fields are extracted`,
    );
  }
}
