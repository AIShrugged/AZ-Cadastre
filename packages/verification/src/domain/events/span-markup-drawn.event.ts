import { DomainEvent } from '@cadastre/shared';

import type { DocumentId, PackageId } from '../value-objects/index.js';

// The span working was drawn onto a design set's sheets (COMM-165). Carries how
// many sheets were marked up and never the links to them: an event is a fact
// about the package, and a signed URL expires.
export class SpanMarkupDrawn extends DomainEvent {
  override readonly type = 'verification.SpanMarkupDrawn';

  constructor(
    public readonly packageId: PackageId,
    public readonly documentId: DocumentId,
    public readonly sheetCount: number,
  ) {
    super();
  }
}
