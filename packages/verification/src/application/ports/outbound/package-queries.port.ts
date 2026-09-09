import type {
  PackageId,
  PackageStanding,
  ReportStatus,
} from '../../../domain/value-objects/index.js';
import type {
  PackageDetailView,
  PackagesOverviewView,
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
  /**
   * Where the submission stands, as the set of standings asked for: a row
   * matches any of them. Empty narrows nothing.
   *
   * A set and not one value because the slice an inspector reads the list by is
   * not always a standing — accepted and being read are one job to the person
   * doing it, and a tab that could only name one of the two would list fewer
   * submissions than its own count.
   */
  readonly standings: readonly PackageStanding[];
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

/**
 * The window a summary covers, over the moment a submission was accepted.
 *
 * One anchor for every slice of the answer, and deliberately not one per slice:
 * counting the submissions by when they arrived and their findings by when the
 * report was compiled would be two answers about two different sets, and a
 * reader would be adding up numbers that were never about the same packages
 * (ADR-0017).
 */
export type OverviewPeriod = {
  // Inclusive. Null is every submission the office has ever taken in.
  readonly from: Date | null;
  // Exclusive, so two adjacent periods neither overlap nor leave a crack
  // between them. Null is up to now.
  readonly to: Date | null;
};

export abstract class PackageQueries {
  abstract listSummaries(
    criteria: PackageListCriteria,
  ): Promise<PackageListPage>;

  abstract findSummary(id: PackageId): Promise<PackageSummaryView | null>;

  abstract findDetail(id: PackageId): Promise<PackageDetailView | null>;

  /**
   * The four tallies of a period, counted by the database in one transaction.
   *
   * One call and not four: numbers taken by separate calls are numbers from
   * separate moments, and a submission that finishes between two of them is
   * counted as under way by one and as reported on by the next.
   */
  abstract overview(period: OverviewPeriod): Promise<PackagesOverviewView>;
}
