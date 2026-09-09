import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import {
  PackageStanding,
  ReportStatus,
} from '../../../../domain/value-objects/index.js';
import {
  PackageQueries,
  type PackageListPage,
} from '../../../ports/outbound/index.js';

import { ListPackagesQuery } from './list-packages.query.js';

@QueryHandler(ListPackagesQuery)
export class ListPackagesHandler implements IQueryHandler<
  ListPackagesQuery,
  PackageListPage
> {
  constructor(
    @Inject(PackageQueries) private readonly packages: PackageQueries,
  ) {}

  execute(query: ListPackagesQuery): Promise<PackageListPage> {
    // Parsed here and not at the register: a standing nobody names is refused
    // by the domain's own enumeration, in the domain's own words, rather than
    // reaching the database as a string that matches nothing and answering
    // with an empty page that looks like an honest answer.
    return this.packages.listSummaries({
      search: query.search ?? null,
      standings: (query.standings ?? []).map(standing =>
        PackageStanding.named(standing),
      ),
      reportStatus: query.reportStatus
        ? ReportStatus.of(query.reportStatus)
        : null,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
