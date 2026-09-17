import { DomainEvent } from '@cadastre/shared';

import type {
  ArchiveQrStatus,
  DocumentId,
  PackageId,
} from '../value-objects/index.js';

export class ArchiveQrCheckMade extends DomainEvent {
  override readonly type = 'verification.ArchiveQrCheckMade';

  constructor(
    public readonly packageId: PackageId,
    public readonly documentId: DocumentId,
    public readonly status: ArchiveQrStatus,
  ) {
    super();
  }
}
