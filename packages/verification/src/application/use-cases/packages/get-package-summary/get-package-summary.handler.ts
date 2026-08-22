import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import { PackageId } from '../../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../../exceptions/index.js';
import { PackageQueries } from '../../../ports/outbound/index.js';
import type { PackageSummaryView } from '../../../read-models/index.js';

import { GetPackageSummaryQuery } from './get-package-summary.query.js';

@QueryHandler(GetPackageSummaryQuery)
export class GetPackageSummaryHandler implements IQueryHandler<
  GetPackageSummaryQuery,
  PackageSummaryView
> {
  constructor(private readonly packages: PackageQueries) {}

  async execute(query: GetPackageSummaryQuery): Promise<PackageSummaryView> {
    const packageId = PackageId.of(query.packageId);
    const summary = await this.packages.findSummary(packageId);

    if (!summary) throw new PackageNotFoundException(packageId);

    return summary;
  }
}
