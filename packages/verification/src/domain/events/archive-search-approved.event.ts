import { DomainEvent } from '@cadastre/shared';

import type { PackageId } from '../value-objects/index.js';

/**
 * A person signed for what the archive register answered about a submission.
 *
 * It names no author because there is none to name: the system has no accounts,
 * so what is recorded is that the approval happened, when, and how many of the
 * register's answers it covered (ADR-0016).
 */
export class ArchiveSearchApproved extends DomainEvent {
  override readonly type = 'verification.ArchiveSearchApproved';

  constructor(
    public readonly packageId: PackageId,
    public readonly checkCount: number,
  ) {
    super();
  }
}
