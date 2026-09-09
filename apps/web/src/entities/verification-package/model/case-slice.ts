/**
 * The slices the case register is read by — the six views an operator switches
 * between: everything, what the machine is still working on, what carries
 * remarks, what is short of papers, what came out clean, and what broke down.
 *
 * **A slice is not a seventh filter.** Each one is a shorthand for a value of
 * one of the two filters the endpoint already takes, and which of the two it
 * narrows is the whole point: `Processing` and `Error` are about the machine and
 * narrow `standing`; `Remarks`, `Incomplete` and `Clean` are about what the run
 * found and narrow `reportStatus`. Folding them into one control would answer
 * one of those questions and silently drop the other (ADR-0014).
 *
 * **The counts come from the summary and not from six calls.** The overview
 * counts every slice in one database transaction, so the six numbers describe
 * the same instant; six separate calls would count six moments and the tabs
 * would not add up to All. That is also why the mapping below is written
 * against the tallies the overview publishes — a slice whose count could not be
 * read off them is a slice whose tab would lie.
 *
 * One consequence is stated rather than hidden: a submission accepted and not
 * yet started stands `Queued`, and the list endpoint narrows by one standing at
 * a time, so `Processing` lists the ones a run is actually reading. The queued
 * ones are in `All`, and in the tally the overview reports as `Pending`.
 */
import type {
  PackagesOverviewResponse,
  PackageStanding,
  ReportStatus,
} from '@cadastre/api-contracts/verification';

export type CaseSlice =
  'all' | 'processing' | 'remarks' | 'incomplete' | 'clean' | 'error';

/** In the order the tabs read, which is the order the work moves. */
export const CASE_SLICES: readonly CaseSlice[] = [
  'all',
  'processing',
  'remarks',
  'incomplete',
  'clean',
  'error',
];

export const SLICE_KEY: Record<CaseSlice, string> = {
  all: 'slice.all',
  processing: 'slice.processing',
  remarks: 'slice.remarks',
  incomplete: 'slice.incomplete',
  clean: 'slice.clean',
  error: 'slice.error',
};

/** What each slice narrows, as the two filters the endpoint takes. */
type SliceFilters = {
  standing: PackageStanding | null;
  reportStatus: ReportStatus | null;
};

const FILTERS: Record<CaseSlice, SliceFilters> = {
  all: { standing: null, reportStatus: null },
  processing: { standing: 'UnderVerification', reportStatus: null },
  remarks: { standing: null, reportStatus: 'IssuesFound' },
  incomplete: { standing: null, reportStatus: 'IncompletePackage' },
  clean: { standing: null, reportStatus: 'OK' },
  error: { standing: 'Stalled', reportStatus: null },
};

export function sliceFilters(slice: CaseSlice): SliceFilters {
  return FILTERS[slice];
}

/**
 * Which slice a pair of filters is. `null` where the register has been narrowed
 * to something no tab stands for — a standing chosen from the filter beside
 * them, say — and the tab strip then shows none selected rather than claiming
 * one: a highlighted tab that does not describe the rows under it is worse than
 * no highlight at all.
 */
export function sliceOf(filters: SliceFilters): CaseSlice | null {
  return (
    CASE_SLICES.find(
      slice =>
        FILTERS[slice].standing === filters.standing &&
        FILTERS[slice].reportStatus === filters.reportStatus,
    ) ?? null
  );
}

/**
 * How many submissions each slice holds, off the one summary call.
 *
 * `processing` is counted by the pipeline's own `Processing` and not by
 * `Pending + Processing`, so the number agrees with the rows the tab lists —
 * a tab reading 3 over a table of 1 is a tab nobody trusts again.
 */
export function sliceCounts(
  overview: PackagesOverviewResponse,
): Record<CaseSlice, number> {
  // Every member is indexed without a fallback because the contract's schemas
  // refuse an answer short of one: a tally that is absent is a response that
  // never parsed, not a slice with nothing in it.
  return {
    all: overview.pipeline.total,
    processing: overview.pipeline.byStatus.Processing,
    remarks: overview.outcomes.byStatus.IssuesFound,
    incomplete: overview.outcomes.byStatus.IncompletePackage,
    clean: overview.outcomes.byStatus.OK,
    error: overview.pipeline.byStatus.Failed,
  };
}
