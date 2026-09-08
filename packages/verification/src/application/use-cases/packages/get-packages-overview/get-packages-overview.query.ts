import { Query } from '@nestjs/cqrs';

import type { PackagesOverviewView } from '../../../read-models/index.js';

/**
 * The four tallies of a period, over the submissions accepted in it.
 *
 * Carried as the contract's own ISO-8601 strings — already validated at the
 * edge — and turned into instants by the handler, for the same reason
 * `ListPackagesQuery` carries strings: a query object holding the context's own
 * types would make the caller build them, which is the edge doing the context's
 * work.
 */
export class GetPackagesOverviewQuery extends Query<PackagesOverviewView> {
  constructor(
    public readonly from: string | undefined,
    public readonly to: string | undefined,
  ) {
    super();
  }
}
