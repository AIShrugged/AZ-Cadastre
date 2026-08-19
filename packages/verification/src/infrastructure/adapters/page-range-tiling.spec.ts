import { describe, expect, it } from 'vitest';

import type { PageRange } from '../../domain/value-objects/index.js';

import { tileIntoRanges } from './page-range-tiling.js';

function spans(ranges: readonly PageRange[]): [number, number][] {
  return ranges.map(range => [range.first.value, range.last.value]);
}

describe('tileIntoRanges', () => {
  it('reads a file nothing starts inside as one document', () => {
    expect(spans(tileIntoRanges([], 4))).toEqual([[1, 4]]);
  });

  it('ends each document on the sheet before the next one starts', () => {
    expect(spans(tileIntoRanges([3, 5], 6))).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('runs the last document to the end of the file', () => {
    expect(spans(tileIntoRanges([4], 9))).toEqual([
      [1, 3],
      [4, 9],
    ]);
  });

  it('starts a document on sheet 1 whether or not it was named', () => {
    expect(spans(tileIntoRanges([1, 3], 4))).toEqual(
      spans(tileIntoRanges([3], 4)),
    );
  });

  it('orders starts the answer gave out of order', () => {
    expect(spans(tileIntoRanges([5, 2], 6))).toEqual([
      [1, 1],
      [2, 4],
      [5, 6],
    ]);
  });

  it('ignores a start named twice', () => {
    expect(spans(tileIntoRanges([3, 3], 4))).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('ignores a start past the end of the file', () => {
    expect(spans(tileIntoRanges([9], 6))).toEqual([[1, 6]]);
  });

  it('ignores a start that is not a whole sheet number', () => {
    expect(spans(tileIntoRanges([2.5, 0, -3], 4))).toEqual([[1, 4]]);
  });

  it('finds no document in a file with no sheets', () => {
    expect(tileIntoRanges([1], 0)).toEqual([]);
  });
});
