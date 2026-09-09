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
    // Every standing asked for, and a row matches any of them. Undefined
    // narrows nothing; a single-element list is the one-standing filter this
    // used to take, which is why the caller says it as a list either way.
    public readonly standings: readonly string[] | undefined,
    public readonly reportStatus: string | undefined,
    public readonly limit: number,
    public readonly offset: number,
  ) {
    super();
  }
}
