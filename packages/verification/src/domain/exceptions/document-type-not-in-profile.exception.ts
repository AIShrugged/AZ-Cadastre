import { DomainException } from '@cadastre/shared';

export class DocumentTypeNotInProfileException extends DomainException {
  override readonly code = 'DOCUMENT_TYPE_NOT_IN_PROFILE';

  constructor(
    public readonly type: string,
    public readonly profileKey: string,
  ) {
    super(`Profile "${profileKey}" does not recognise document type "${type}"`);
  }
}
