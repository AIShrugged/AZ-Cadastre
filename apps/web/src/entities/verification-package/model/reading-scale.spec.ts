import { describe, expect, it } from 'vitest';

import { CONFIDENCE_FLOOR } from '@cadastre/api-contracts/verification';

import {
  READING_BAND_FLOOR,
  readingBand,
  readingPercent,
  readReading,
} from './reading-scale';

describe('readingBand', () => {
  // The customer's own three thresholds, checked on both sides of each line —
  // an off-by-one here prints the wrong colour beside a correct number, which
  // is the one failure nobody reading the screen can catch.
  it.each([
    [0, 'low'],
    [59.9, 'low'],
    [60, 'fair'],
    [79, 'fair'],
    [79.9, 'fair'],
    [80, 'sure'],
    [100, 'sure'],
  ] as const)('bands %s percent as %s', (percent, band) => {
    expect(readingBand(percent)).toBe(band);
  });

  it('bands a figure above the scale as sure and one below it as low', () => {
    expect(readingBand(120)).toBe('sure');
    expect(readingBand(-1)).toBe('low');
  });

  it('starts each band where the published floor says it does', () => {
    expect(READING_BAND_FLOOR).toEqual({ sure: 80, fair: 60, low: 0 });
  });
});

describe('readReading', () => {
  it('reads a confidence of 0..1 as the figure and its band', () => {
    expect(readReading(0.59)).toEqual({ percent: 59, band: 'low' });
    expect(readReading(0.6)).toEqual({ percent: 60, band: 'fair' });
    expect(readReading(0.799)).toEqual({ percent: 80, band: 'sure' });
    expect(readReading(1)).toEqual({ percent: 100, band: 'sure' });
  });

  // The whole reason the figure is computed here: a colour that disagrees with
  // the number printed beside it is the screen contradicting itself.
  it('bands the figure it prints, never the value behind it', () => {
    for (const confidence of [0, 0.004, 0.595, 0.5951, 0.798, 0.8049, 0.999]) {
      const { percent, band } = readReading(confidence);
      expect(band).toBe(readingBand(percent));
      expect(percent).toBe(readingPercent(confidence));
    }
  });

  // One decision in two units: the green band starts exactly where the engine
  // stops doubting a reading. Written as an assertion so that moving either
  // number alone — and printing green over a value the report flags — fails the
  // build rather than the screen (COMM-129).
  it('starts the green band exactly at the engine floor', () => {
    expect(READING_BAND_FLOOR.sure).toBe(CONFIDENCE_FLOOR * 100);

    expect(readReading(CONFIDENCE_FLOOR).band).toBe('sure');
    expect(readReading(CONFIDENCE_FLOOR - 0.01).band).not.toBe('sure');
  });
});
