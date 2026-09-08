import { DomainEvent } from '@cadastre/shared';

import type { PackageId } from '../value-objects/index.js';

/**
 * The archive search an approval covered was made again, so the approval is
 * spent: it approved answers the package no longer holds, and a signature left
 * standing over answers nobody has read is worse than none (ADR-0016).
 */
export class ArchiveSearchApprovalSpent extends DomainEvent {
  override readonly type = 'verification.ArchiveSearchApprovalSpent';

  constructor(public readonly packageId: PackageId) {
    super();
  }
}
