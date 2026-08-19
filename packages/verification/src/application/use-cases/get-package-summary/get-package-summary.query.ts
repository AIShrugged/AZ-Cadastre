import { Query } from '@nestjs/cqrs';

import type { PackageSummaryView } from '../../read-models/index.js';

export class GetPackageSummaryQuery extends Query<PackageSummaryView> {
  constructor(public readonly packageId: string) {
    super();
  }
}
