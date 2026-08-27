import { DomainException } from '@cadastre/shared';

export class InvalidDocumentTypeException extends DomainException {
  override readonly code = 'INVALID_DOCUMENT_TYPE';

  constructor(public readonly reason: 'empty' | 'too_long') {
    super(`A document type key must not be ${reason.replace('_', ' ')}`);
  }
}
