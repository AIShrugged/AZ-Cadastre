import { DomainEvent } from '@cadastre/shared';

import type { PackageId } from '../value-objects/index.js';

/**
 * Files reached a package that already existed. What the pipeline does about it
 * is the same thing it does about a submission — read the package — which is
 * why one handler answers both (ADR-0013).
 */
export class FilesAdded extends DomainEvent {
  override readonly type = 'verification.FilesAdded';

  constructor(
    public readonly packageId: PackageId,
    public readonly fileCount: number,
  ) {
    super();
  }
}
