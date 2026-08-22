import { Query } from '@nestjs/cqrs';

import type { PackageDetailView } from '../../../read-models/index.js';

export class GetPackageQuery extends Query<PackageDetailView> {
  constructor(public readonly packageId: string) {
    super();
  }
}
