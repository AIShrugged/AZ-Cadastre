/**
 * Dates, in the three languages the workspace is read in.
 *
 * The Azerbaijani cases are the reason this file exists. Chromium carries no
 * `az` date data — `Intl.DateTimeFormat('az-Latn-AZ')` resolves to `az`, falls
 * through to the root locale and answers "2026 M09 09" whether it is asked for
 * a short month or a long one — so every date an Azerbaijani-speaking operator
 * saw was one they could not read. Node has the data and answers correctly,
 * which is exactly why a test that only asked `Intl` would have proved nothing.
 *
 * So the AZ assertions are on the strings themselves, and they are the strings
 * full ICU returns: the browser has to agree with Node, not with whichever
 * locale data it happens to ship.
 */
import { describe, expect, it } from 'vitest';

import { formatDate } from './i18n';

/** Midday, so no time zone this test could run in moves the day. */
const noon = (month: number, day = 9) =>
  new Date(2026, month, day, 12, 0, 0).toISOString();

describe('formatDate', () => {
  it('writes the Azerbaijani month rather than the root locale’s "M09"', () => {
    expect(formatDate(noon(8), 'az')).toBe('09 sen 2026');
  });

  it('names every Azerbaijani month as full ICU names it', () => {
    const year = Array.from({ length: 12 }, (_, month) =>
      formatDate(noon(month, 15), 'az'),
    );

    expect(year).toEqual([
      '15 yan 2026',
      '15 fev 2026',
      '15 mar 2026',
      '15 apr 2026',
      '15 may 2026',
      '15 iyn 2026',
      '15 iyl 2026',
      '15 avq 2026',
      '15 sen 2026',
      '15 okt 2026',
      '15 noy 2026',
      '15 dek 2026',
    ]);
  });

  it('pads the Azerbaijani day, so a column of dates lines up', () => {
    expect(formatDate(noon(0, 1), 'az')).toBe('01 yan 2026');
  });

  it('leaves the locales the browser does have to the browser', () => {
    // Both carry a month name and not a number — the check is that the AZ
    // branch did not take over the two locales that were never broken.
    expect(formatDate(noon(8), 'en')).toMatch(/Sep/);
    expect(formatDate(noon(8), 'ru')).toMatch(/сент/);
  });

  it('hands back what it was given when that is not a date', () => {
    // The old fallback called `toISOString` on an invalid date, which throws
    // the same way the formatter it was catching for does.
    expect(formatDate('not a date', 'az')).toBe('not a date');
    expect(formatDate('not a date', 'en')).toBe('not a date');
  });
});
