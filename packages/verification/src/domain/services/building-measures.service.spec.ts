import { describe, expect, it } from 'vitest';

import {
  dateSpanIn,
  heightInMetres,
  spanInMetres,
  storeysIn,
  yearIn,
} from './building-measures.service.js';

describe('heightInMetres', () => {
  it('reads a height written in metres', () => {
    expect(heightInMetres('12 m')).toBe(12);
  });

  it('reads a decimal comma, which is how the drawings write it', () => {
    expect(heightInMetres('9,4 m')).toBe(9.4);
  });

  it('reads a decimal point just the same', () => {
    expect(heightInMetres('9.4 m')).toBe(9.4);
  });

  it('reads a bare figure as metres, since that is the unit the line is headed in', () => {
    expect(heightInMetres('12')).toBe(12);
  });

  it('converts the smaller units the same drawings use', () => {
    expect(heightInMetres('940 sm')).toBeCloseTo(9.4, 6);
    expect(heightInMetres('940 см')).toBeCloseTo(9.4, 6);
    expect(heightInMetres('9400 mm')).toBeCloseTo(9.4, 6);
  });

  it('reads the Russian and the Azerbaijani spelling of the same unit', () => {
    expect(heightInMetres('12 м')).toBe(12);
    expect(heightInMetres('12 metr')).toBe(12);
  });

  it('ignores what is written after the unit', () => {
    expect(heightInMetres('9,4 m (təxmini)')).toBe(9.4);
  });

  it('reads the figure out of a line that names it', () => {
    expect(heightInMetres('H = 9,4 m')).toBe(9.4);
  });

  /*
   * The one thing this must never do. "2 mərtəbə" is two storeys, and a branch
   * that read it as two metres would put a house in the lowest band it has
   * with the same confidence as a house that really is two metres tall.
   */
  it('refuses a figure under a unit it does not know', () => {
    expect(heightInMetres('2 mərtəbə')).toBeNull();
    expect(heightInMetres('2 storeys')).toBeNull();
  });

  it('reads nothing out of a value carrying no figure', () => {
    expect(heightInMetres('')).toBeNull();
    expect(heightInMetres('not stated')).toBeNull();
  });
});

describe('yearIn', () => {
  it('reads the year out of a date written the way these papers write it', () => {
    expect(yearIn('18.12.2025')).toBe(2025);
  });

  it('reads the year out of an ISO date', () => {
    expect(yearIn('2025-12-18')).toBe(2025);
  });

  it('reads a year written on its own', () => {
    expect(yearIn('2008')).toBe(2008);
  });

  it('reads the year out of a line that says more than the date', () => {
    expect(yearIn('təsdiq edilib 18.12.2025')).toBe(2025);
  });

  it('passes over a four-digit run that could not be a year', () => {
    expect(yearIn('AZ-CAD-1024-311')).toBeNull();
  });

  it('reads nothing where no run of four digits stands on its own', () => {
    expect(yearIn('12.03.99')).toBeNull();
    expect(yearIn('QB-2025888301')).toBeNull();
    expect(yearIn('')).toBeNull();
  });
});

describe('spanInMetres', () => {
  it('reads the longest of the spacings a plan dimensions', () => {
    expect(spanInMetres('A—B 6,00 m; B—C 5,40 m; 1—2 4,80 m')).toBe(6);
  });

  // "1—2 4,80 m" names the axes before it states the spacing, and an axis
  // number is not a length.
  it('takes the last length of an entry, not the axis numbers before it', () => {
    expect(spanInMetres('1—2 4,80 m')).toBe(4.8);
  });

  it('reads a bare dimension on a plan as millimetres', () => {
    expect(spanInMetres('A—B 6000; B—C 5400')).toBeCloseTo(6, 6);
  });

  it('reads a small bare figure as metres', () => {
    expect(spanInMetres('4,2')).toBe(4.2);
  });

  it('reads nothing out of a value that states no length', () => {
    expect(spanInMetres('')).toBeNull();
    expect(spanInMetres('not stated')).toBeNull();
  });
});

describe('storeysIn', () => {
  it('reads a count written alone or with its word', () => {
    expect(storeysIn('2')).toBe(2);
    expect(storeysIn('2 mərtəbə')).toBe(2);
    expect(storeysIn('3 этажа')).toBe(3);
  });

  // "2,5 m" is a height, and truncating it to two storeys would be a guess.
  it('passes over a figure with a fractional part', () => {
    expect(storeysIn('2,5 m')).toBeNull();
  });

  it('passes over a year', () => {
    expect(storeysIn('2014')).toBeNull();
  });

  it('reads nothing out of a value that states no count', () => {
    expect(storeysIn('')).toBeNull();
  });
});

describe('dateSpanIn', () => {
  it('reads a date written day first', () => {
    expect(dateSpanIn('12.05.1995')).toEqual({
      first: '1995-05-12',
      last: '1995-05-12',
    });
  });

  it('reads an ISO date', () => {
    expect(dateSpanIn('1995-05-12')).toEqual({
      first: '1995-05-12',
      last: '1995-05-12',
    });
  });

  // A paper whose day went unread is not thereby dated 1 January.
  it('reads a year alone as the whole of that year', () => {
    expect(dateSpanIn('1995-ci il')).toEqual({
      first: '1995-01-01',
      last: '1995-12-31',
    });
  });

  it('refuses a day the calendar does not have, and falls back to the year', () => {
    expect(dateSpanIn('31.02.1995')).toEqual({
      first: '1995-01-01',
      last: '1995-12-31',
    });
  });

  it('reads nothing out of a value that states no date', () => {
    expect(dateSpanIn('')).toBeNull();
  });
});
