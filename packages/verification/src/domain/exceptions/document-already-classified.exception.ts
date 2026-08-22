import { DomainException } from '@cadastre/shared';

export class DocumentAlreadyClassifiedException extends DomainException {
  override readonly code = 'DOCUMENT_ALREADY_CLASSIFIED';

  constructor(
    public readonly documentId: string,
    public readonly type: string,
  ) {
    super(`Document ${documentId} was already classified as "${type}"`);
  }
}
