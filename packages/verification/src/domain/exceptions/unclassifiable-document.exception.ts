import { DomainException } from '@cadastre/shared';

export class UnclassifiableDocumentException extends DomainException {
  override readonly code = 'UNCLASSIFIABLE_DOCUMENT';

  constructor(public readonly documentId: string) {
    super(`Document ${documentId} has no known type, so it declares no fields`);
  }
}
