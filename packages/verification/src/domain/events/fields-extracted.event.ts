import { DomainEvent } from '@cadastre/shared';

import type { DocumentId, PackageId } from '../value-objects/index.js';

export class FieldsExtracted extends DomainEvent {
  override readonly type = 'verification.FieldsExtracted';

  constructor(
    public readonly packageId: PackageId,
    public readonly documentId: DocumentId,
    public readonly fieldCount: number,
  ) {
    super();
  }
}
