import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import { PackageQueries } from '../../../ports/outbound/index.js';
import type { PackagesOverviewView } from '../../../read-models/index.js';

import { GetPackagesOverviewQuery } from './get-packages-overview.query.js';

@QueryHandler(GetPackagesOverviewQuery)
export class GetPackagesOverviewHandler implements IQueryHandler<
  GetPackagesOverviewQuery,
  PackagesOverviewView
> {
  constructor(
    @Inject(PackageQueries) private readonly packages: PackageQueries,
  ) {}

  execute(query: GetPackagesOverviewQuery): Promise<PackagesOverviewView> {
    // An absent bound is an open end and not "now" or "the beginning of time":
    // a period the caller did not name is one the register is free to answer
    // without a predicate at all.
    return this.packages.overview({
      from: query.from ? new Date(query.from) : null,
      to: query.to ? new Date(query.to) : null,
    });
  }
}
