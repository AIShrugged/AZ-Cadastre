import type {
  PackageId,
  PackageStanding,
  ReportStatus,
} from '../../../domain/value-objects/index.js';
import type {
  PackageDetailView,
  PackageSummaryView,
} from '../../read-models/index.js';

/**
 * What the list is narrowed to, in the context's own words rather than the
 * contract's strings: the use case turns what a caller asked for into these,
 * and a standing the domain does not name never reaches the database.
 */
export type PackageListCriteria = {
  /**
   * What the inspector typed, already trimmed; null when the box was empty.
   * What counts as a match is the register's own business and is stated where
   * it is implemented — the contract's `ListPackagesRequestSchema` says the
   * same thing to a caller.
   */
  readonly search: string | null;
  // Where the submission stands. Null narrows nothing.
  readonly standing: PackageStanding | null;
  // What the run found. A separate question from the standing, so a separate
  // criterion: a package with no report at all answers neither.
  readonly reportStatus: ReportStatus | null;
  readonly limit: number;
  readonly offset: number;
};

/**
 * One page of the list, with the size of the whole answer beside it — a pager
 * that cannot say how many pages there are is a pager nobody can use, and the
 * count has to be taken where the filter is or it counts something else.
 */
export type PackageListPage = {
  readonly items: readonly PackageSummaryView[];
  // Rows the criteria matched, not rows in this page.
  readonly total: number;
};

export abstract class PackageQueries {
  abstract listSummaries(
    criteria: PackageListCriteria,
  ): Promise<PackageListPage>;

  abstract findSummary(id: PackageId): Promise<PackageSummaryView | null>;

  abstract findDetail(id: PackageId): Promise<PackageDetailView | null>;
}
