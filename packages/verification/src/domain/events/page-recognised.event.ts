import { DomainEvent } from '@cadastre/shared';

import type {
  PackageId,
  PageId,
  SourceFileId,
} from '../value-objects/index.js';

export class PageRecognised extends DomainEvent {
  override readonly type = 'verification.PageRecognised';

  constructor(
    public readonly packageId: PackageId,
    public readonly sourceFileId: SourceFileId,
    public readonly pageId: PageId,
  ) {
    super();
  }
}
