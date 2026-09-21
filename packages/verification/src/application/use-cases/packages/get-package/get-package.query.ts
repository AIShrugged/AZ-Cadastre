import { Query } from '@nestjs/cqrs';

import type { PackageDetailView } from '../../../read-models/index.js';

export class GetPackageQuery extends Query<PackageDetailView> {
  constructor(
    public readonly packageId: string,
    /**
     * Whose submissions this call may see: an account id, or `null` for every
     * one the office holds.
     *
     * A required argument and not an optional filter. A call that forgot it
     * would compile, run, and hand one applicant somebody else's papers
     * (ADR-0029).
     */
    public readonly ownerAccountId: string | null,
  ) {
    super();
  }
}
