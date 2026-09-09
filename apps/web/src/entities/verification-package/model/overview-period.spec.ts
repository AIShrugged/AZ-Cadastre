import { describe, expect, it } from 'vitest';

import { PackagesOverviewRequestSchema } from '@cadastre/api-contracts/verification';

import {
  coversWholeRegister,
  OVERVIEW_PERIODS,
  parseOverviewPeriod,
  toOverviewRequest,
  WHOLE_REGISTER_PERIOD,
  withOverviewPeriod,
  type OverviewPeriod,
} from './overview-period';

const read = (search: string) =>
  parseOverviewPeriod(new URLSearchParams(search));
const written = (search: string, period: OverviewPeriod) =>
  withOverviewPeriod(new URLSearchParams(search), period).toString();

// A Wednesday in the middle of a month, so a calendar anchor and a rolling one
// cannot accidentally land on the same instant and pass for each other.
const NOON = new Date(2026, 8, 16, 12, 0, 0).getTime();

describe('the window the summary is read over', () => {
  it('is the whole register when the address names none', () => {
    expect(read('')).toBe(WHOLE_REGISTER_PERIOD);
    expect(toOverviewRequest(read(''), NOON)).toEqual({});
  });

  // An address is typed by hand and outlives the build that wrote it. A window
  // this client has never heard of must be the whole register rather than a
  // blank screen — the same forgiveness the register's own query is read with.
  it('falls back to the whole register on a window it does not know', () => {
    expect(read('period=fortnight')).toBe(WHOLE_REGISTER_PERIOD);
    expect(read('period=')).toBe(WHOLE_REGISTER_PERIOD);
  });

  it('reads back every window it offers', () => {
    for (const period of OVERVIEW_PERIODS) {
      expect(read(`period=${period}`)).toBe(period);
    }
  });
});

describe('the window in the address bar', () => {
  // The register's search, filters and page are rewritten wholesale on every
  // change. If the period did not survive that rewrite, typing one character in
  // the search box would silently reset the summary to the whole register.
  it('survives a rewrite of the register’s own question', () => {
    expect(written('search=baku&page=3', 'last7')).toBe(
      'search=baku&page=3&period=last7',
    );
  });

  // The whole register keeps a clean address, so a link copied off an untouched
  // screen says "the register" rather than "the register as somebody left it".
  it('is left out of the address when it is the whole register', () => {
    expect(written('search=baku&period=year', 'all')).toBe('search=baku');
    expect(written('', 'all')).toBe('');
  });

  it('replaces a window rather than adding a second one', () => {
    expect(written('period=month', 'year')).toBe('period=year');
  });
});

describe('the window as the endpoint takes it', () => {
  // Every request this builds has to be one the edge accepts, or the summary is
  // a 400 the reader sees as a broken screen.
  it('builds a request the contract accepts, for every window', () => {
    for (const period of OVERVIEW_PERIODS) {
      const parsed = PackagesOverviewRequestSchema.safeParse(
        toOverviewRequest(period, NOON),
      );
      expect(parsed.success, period).toBe(true);
    }
  });

  // Every window here ends at the present. `to` is exclusive, so naming one
  // would drop the submission accepted while the page was open — the summary
  // would be answering about a period that had closed behind the reader.
  it('never names an upper bound', () => {
    for (const period of OVERVIEW_PERIODS) {
      expect(toOverviewRequest(period, NOON).to).toBeUndefined();
    }
  });

  it('measures the rolling windows back from the instant it is given', () => {
    const day = 24 * 60 * 60 * 1000;
    expect(toOverviewRequest('last7', NOON).from).toBe(
      new Date(NOON - 7 * day).toISOString(),
    );
    expect(toOverviewRequest('last30', NOON).from).toBe(
      new Date(NOON - 30 * day).toISOString(),
    );
  });

  // "This month" is the month the office is in, not a 30-day tail: it resets on
  // the 1st, in the reader's own timezone.
  it('anchors the calendar windows to the reader’s own month and year', () => {
    expect(toOverviewRequest('month', NOON).from).toBe(
      new Date(2026, 8, 1).toISOString(),
    );
    expect(toOverviewRequest('year', NOON).from).toBe(
      new Date(2026, 0, 1).toISOString(),
    );
  });
});

describe('whether a count may be a link', () => {
  // The list endpoint narrows by standing and by outcome but takes no period,
  // so only the whole register holds exactly what a narrowed count counted. A
  // number that opens a different set than it counted is worse than one that
  // opens nothing, and this is the single place that judgement is made.
  it('is true only for the whole register', () => {
    expect(coversWholeRegister('all')).toBe(true);
    for (const period of OVERVIEW_PERIODS.filter(p => p !== 'all')) {
      expect(coversWholeRegister(period), period).toBe(false);
    }
  });
});
