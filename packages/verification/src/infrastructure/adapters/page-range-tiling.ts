import { PageNumber, PageRange } from '../../domain/value-objects/index.js';

// A segmentation is fully described by the sheets a new document starts on. Any
// set of those — a model's sloppy answer included — becomes ranges that tile the
// file: out-of-range and duplicate starts are dropped, page 1 always starts one,
// and the last document runs to the end. The aggregate refuses anything else, and
// a provider naming page 9 of a 6-page file should not fail the whole package.
export function tileIntoRanges(
  starts: readonly number[],
  pageCount: number,
): readonly PageRange[] {
  if (pageCount < 1) return [];

  const boundaries = [
    ...new Set([
      1,
      ...starts.filter(
        start => Number.isInteger(start) && start > 1 && start <= pageCount,
      ),
    ]),
  ].sort((left, right) => left - right);

  return boundaries.map((start, index) =>
    PageRange.of(
      PageNumber.of(start),
      PageNumber.of((boundaries[index + 1] ?? pageCount + 1) - 1),
    ),
  );
}
