import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import { PackageQueries } from '../../../ports/outbound/index.js';
import type { PackageSummaryView } from '../../../read-models/index.js';

import { ListPackagesQuery } from './list-packages.query.js';

@QueryHandler(ListPackagesQuery)
export class ListPackagesHandler implements IQueryHandler<
  ListPackagesQuery,
  readonly PackageSummaryView[]
> {
  constructor(private readonly packages: PackageQueries) {}

  execute(): Promise<readonly PackageSummaryView[]> {
    return this.packages.listSummaries();
  }
}
