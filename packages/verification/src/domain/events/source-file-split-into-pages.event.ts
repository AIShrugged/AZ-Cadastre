import { DomainEvent } from '@cadastre/shared';

import type { PackageId, SourceFileId } from '../value-objects/index.js';

export class SourceFileSplitIntoPages extends DomainEvent {
  override readonly type = 'verification.SourceFileSplitIntoPages';

  constructor(
    public readonly packageId: PackageId,
    public readonly sourceFileId: SourceFileId,
    public readonly pageCount: number,
  ) {
    super();
  }
}
