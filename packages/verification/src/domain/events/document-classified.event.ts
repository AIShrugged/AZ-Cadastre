import { DomainEvent } from '@cadastre/shared';

import type {
  Classification,
  DocumentId,
  PackageId,
} from '../value-objects/index.js';

export class DocumentClassified extends DomainEvent {
  override readonly type = 'verification.DocumentClassified';

  constructor(
    public readonly packageId: PackageId,
    public readonly documentId: DocumentId,
    public readonly classification: Classification,
  ) {
    super();
  }
}
