import { Query } from '@nestjs/cqrs';

import type { PackageListPage } from '../../../ports/outbound/index.js';

/**
 * One page of the submissions, narrowed by what the caller asked for.
 *
 * Carried as the contract's own strings and numbers — already validated at the
 * edge — and turned into the context's words by the handler: a query object
 * that held domain value objects would make the caller construct them, which
 * is the edge doing the context's work.
 */
export class ListPackagesQuery extends Query<PackageListPage> {
  constructor(
    public readonly search: string | undefined,
    public readonly standing: string | undefined,
    public readonly reportStatus: string | undefined,
    public readonly limit: number,
    public readonly offset: number,
  ) {
    super();
  }
}
