import { DomainEvent } from '@cadastre/shared';

import type { PackageId, SourceFileId } from '../value-objects/index.js';

export class SourceFileSegmented extends DomainEvent {
  override readonly type = 'verification.SourceFileSegmented';

  constructor(
    public readonly packageId: PackageId,
    public readonly sourceFileId: SourceFileId,
    public readonly documentCount: number,
  ) {
    super();
  }
}
