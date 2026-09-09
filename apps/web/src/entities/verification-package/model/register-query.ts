/**
 * What the register asks the server for, and how that question travels in the
 * address bar.
 *
 * Nothing here narrows a list. The search, the two filters and the page are the
 * server's to answer over every submission the office has ever taken in, never
 * over the page it last sent (ADR-0015) — a client that filtered what it was
 * given would be filtering one page of twenty and calling it the register.
 *
 * **The two filters are two parameters because they are two questions.** Where a
 * submission stands is what has to happen to it next; what the run found is what
 * the report holds against the papers. They part company constantly: a package
 * with findings against it and a signature still outstanding stands
 * `NeedsInspector` while its report reads `IssuesFound`, and a package that has
 * been cleared may still carry the findings of the run that read it. One control
 * over both could only answer one of them and would silently drop the other.
 *
 * The question lives in the URL rather than in component state so a narrowed
 * register can be linked to and returned to — the same reason a package and a
 * profile each have an address of their own.
 */
import {
  LIST_PACKAGES_DEFAULT_LIMIT,
  PackageStandingSchema,
  ReportStatusSchema,
  type ListPackagesRequestInput,
  type PackageStanding,
  type ReportStatus,
} from '@cadastre/api-contracts/verification';

export type RegisterQuery = {
  /** What the inspector typed, trimmed. Empty is no term rather than a term
   *  that matches nothing — that is what a cleared search box means. */
  search: string;
  /** Where the submission stands. Null is every standing, not a seventh one. */
  standing: PackageStanding | null;
  /** What the run made of it. Null is every outcome, including no report yet. */
  reportStatus: ReportStatus | null;
  /** 1-based, the way a pager counts. The wire counts rows from zero. */
  page: number;
};

/**
 * How many rows one page holds — the endpoint's own default, taken from the
 * contract rather than chosen here, so the pager and the server never disagree
 * about what a page is.
 *
 * Density is not this number. How tall a row is drawn is a question about the
 * screen; how many rows are fetched is a question about the call, and letting a
 * display toggle change the request would re-page the register every time
 * somebody wanted to see more at once.
 */
export const REGISTER_PAGE_SIZE = LIST_PACKAGES_DEFAULT_LIMIT;

/** The register asked for nothing in particular: every submission, newest
 *  first, from the top. */
export const WHOLE_REGISTER: RegisterQuery = {
  search: '',
  standing: null,
  reportStatus: null,
  page: 1,
};

/**
 * Read the question out of the address bar.
 *
 * Deliberately forgiving: an address is typed by hand, pasted between people
 * and outlives the build that wrote it, so a standing this client has never
 * heard of is *no filter* rather than a refusal. Answering a stale link with a
 * blank screen would lose the register over a word.
 */
export function parseRegisterQuery(params: URLSearchParams): RegisterQuery {
  const standing = PackageStandingSchema.safeParse(params.get('standing'));
  const outcome = ReportStatusSchema.safeParse(params.get('reportStatus'));
  const page = Number(params.get('page'));
  return {
    search: params.get('search')?.trim() ?? '',
    standing: standing.success ? standing.data : null,
    reportStatus: outcome.success ? outcome.data : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/**
 * Write the question back into the address bar, under the contract's own names.
 *
 * Only what narrows the register is written. The whole register keeps a clean
 * address, so the link somebody copies off an untouched screen says "the
 * register" and not "page 1 of the register as it was paged that afternoon".
 */
export function registerQueryParams(query: RegisterQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search !== '') params.set('search', query.search);
  if (query.standing !== null) params.set('standing', query.standing);
  if (query.reportStatus !== null)
    params.set('reportStatus', query.reportStatus);
  if (query.page > 1) params.set('page', String(query.page));
  return params;
}

/** The question as the endpoint takes it: a page of rows, from an offset. */
export function toListRequest(query: RegisterQuery): ListPackagesRequestInput {
  return {
    search: query.search === '' ? undefined : query.search,
    standing: query.standing ?? undefined,
    reportStatus: query.reportStatus ?? undefined,
    limit: REGISTER_PAGE_SIZE,
    offset: (query.page - 1) * REGISTER_PAGE_SIZE,
  };
}

/**
 * Whether anything is holding rows back — which is what an empty answer has to
 * be read against. Nothing found under a filter is a filter to clear; nothing
 * found without one is an office that has taken nothing in, and the two are not
 * the same news.
 */
export function isNarrowed(query: RegisterQuery): boolean {
  return (
    query.search !== '' ||
    query.standing !== null ||
    query.reportStatus !== null
  );
}

/**
 * How many pages the matched rows make, off the answer's own echoed page size
 * rather than the constant above: the answer says which page it is, so a pager
 * built from it cannot describe a page nobody asked for.
 */
export function pageCount(total: number, limit: number): number {
  if (limit <= 0) return 1;
  return Math.max(1, Math.ceil(total / limit));
}
