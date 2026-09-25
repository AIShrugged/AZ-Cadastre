import { DomainException } from '@cadastre/shared';

// A span markup was offered for a paper no span is read off. The three types of
// design documentation declare `span_dimensions`; nothing else does, and a
// picture of the axes of a payment receipt is a picture of nothing (COMM-165).
export class DocumentDimensionsNoSpanException extends DomainException {
  override readonly code = 'DOCUMENT_DIMENSIONS_NO_SPAN';

  constructor(
    public readonly documentId: string,
    public readonly type: string | null,
  ) {
    super(
      `No span is read off document ${documentId} (${type ?? 'unclassified'}), ` +
        'so its sheets carry no span markup',
    );
  }
}
