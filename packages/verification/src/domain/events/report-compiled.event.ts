import { DomainEvent } from '@cadastre/shared';

import type { PackageId, ReportStatus } from '../value-objects/index.js';

export class ReportCompiled extends DomainEvent {
  override readonly type = 'verification.ReportCompiled';

  constructor(
    public readonly packageId: PackageId,
    public readonly status: ReportStatus,
    public readonly issueCount: number,
  ) {
    super();
  }
}
