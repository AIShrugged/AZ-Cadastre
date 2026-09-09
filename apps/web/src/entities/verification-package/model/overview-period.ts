/**
 * The window the summary is read over, and how that choice travels in the
 * address bar.
 *
 * One anchor for all four slices, because the endpoint has one: the period is
 * over when a submission was **accepted**, never over when a report was
 * compiled or when the register answered, so "August" means the submissions
 * taken in during August and everything the summary says is said about those.
 * Four slices anchored on four timestamps would be four answers about four
 * different sets, and the reader would be adding up numbers that were never
 * about the same packages.
 *
 * Named windows and not two date fields. An inspector opens a summary to ask
 * "how did this week go", and a pair of calendars makes them answer a question
 * they did not have in order to ask the one they did. The five below are the
 * questions; the address bar carries the name of the window and never the two
 * instants it worked out to, so a link shared on Tuesday still says "the last
 * seven days" when it is opened on Friday rather than freezing that Tuesday's
 * week.
 */
import type { PackagesOverviewRequestInput } from '@cadastre/api-contracts/verification';

export type OverviewPeriod = 'all' | 'last7' | 'last30' | 'month' | 'year';

/** In the order the select offers them: the whole register first, then windows
 *  widening from a week to a year. */
export const OVERVIEW_PERIODS: readonly OverviewPeriod[] = [
  'all',
  'last7',
  'last30',
  'month',
  'year',
];

/**
 * Every submission the office has ever taken in — the endpoint's own answer to
 * a request that names no bound, and the default here.
 *
 * The default is the *whole* register and not a recent window on purpose: the
 * list of submissions sits on the same screen directly beneath this summary and
 * is itself unbounded, so any other default would put a summary of one set of
 * submissions above a list of another and invite the reader to read the two
 * together.
 */
export const WHOLE_REGISTER_PERIOD: OverviewPeriod = 'all';

/** The window's name, in the reader's language. */
export const PERIOD_KEY: Record<OverviewPeriod, string> = {
  all: 'summary.period.all',
  last7: 'summary.period.last7',
  last30: 'summary.period.last30',
  month: 'summary.period.month',
  year: 'summary.period.year',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Read the window out of the address bar.
 *
 * Forgiving in the same way the register's own query is: an address is typed by
 * hand and outlives the build that wrote it, so a window this client has never
 * heard of is the whole register rather than a refusal.
 */
export function parseOverviewPeriod(params: URLSearchParams): OverviewPeriod {
  const named = params.get('period');
  return (
    OVERVIEW_PERIODS.find(period => period === named) ?? WHOLE_REGISTER_PERIOD
  );
}

/**
 * Write the window into an address that already carries the register's own
 * question.
 *
 * It is folded into the caller's params rather than building its own, because
 * the register's search, filters and page live in the same address bar and are
 * rewritten wholesale on every change — a period held in a second
 * `URLSearchParams` would be dropped the first time somebody typed in the
 * search box.
 */
export function withOverviewPeriod(
  params: URLSearchParams,
  period: OverviewPeriod,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (period === WHOLE_REGISTER_PERIOD) next.delete('period');
  else next.set('period', period);
  return next;
}

/**
 * The window as the endpoint takes it, worked out against a fixed instant the
 * caller supplies.
 *
 * `now` is passed in rather than read here so a render cannot move it: the
 * request is this query's cache key, and a `from` recomputed every millisecond
 * would be a new key every millisecond and a call that never stops.
 *
 * Only `from` is ever sent. Every window here ends at the present, and the
 * endpoint's `to` is exclusive, so naming one would exclude the submission
 * accepted while the page was open — the summary would answer about a period
 * that had already closed behind the reader.
 */
export function toOverviewRequest(
  period: OverviewPeriod,
  now: number,
): PackagesOverviewRequestInput {
  const at = new Date(now);
  switch (period) {
    case 'all':
      return {};
    case 'last7':
      return { from: new Date(now - 7 * DAY_MS).toISOString() };
    case 'last30':
      return { from: new Date(now - 30 * DAY_MS).toISOString() };
    // Calendar-anchored and not rolling, because that is the question: "this
    // month" is the month the office is in, in the reader's own timezone, and
    // it resets on the 1st rather than sliding a 30-day tail behind it.
    case 'month':
      return {
        from: new Date(at.getFullYear(), at.getMonth(), 1).toISOString(),
      };
    case 'year':
      return { from: new Date(at.getFullYear(), 0, 1).toISOString() };
  }
}

/**
 * Whether this window holds every submission the register holds.
 *
 * What the summary's links hang on. The list endpoint narrows by standing and
 * by outcome but not by a period (`ListPackagesRequest`), so a link out of a
 * narrowed summary would land the reader on a different set of submissions than
 * the number they clicked counted. A number that leads somewhere else is worse
 * than a number that leads nowhere, so under any window but this one the counts
 * are drawn as text and not as links.
 */
export function coversWholeRegister(period: OverviewPeriod): boolean {
  return period === WHOLE_REGISTER_PERIOD;
}
