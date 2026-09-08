import { describe, expect, it } from 'vitest';

import { heightInMetres, yearIn } from './building-measures.service.js';

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
