import { describe, expect, it } from "vitest";

import { InvalidPageRangeException } from "../exceptions/index.js";
import { PageNumber } from "./page-number.vo.js";
import { PageRange } from "./page-range.vo.js";

function range(first: number, last: number): PageRange {
  return PageRange.of(PageNumber.of(first), PageNumber.of(last));
}

describe("PageRange", () => {
  it("spans the sheets between its ends, inclusive", () => {
    expect(range(2, 4).count).toBe(3);
  });

  it("counts a range that starts and ends on the same sheet as one", () => {
    expect(range(3, 3).count).toBe(1);
    expect(range(3, 3).isSingleSheet).toBe(true);
  });

  it("reads a sheet built from one page number as a single sheet", () => {
    expect(PageRange.single(PageNumber.of(5)).isSingleSheet).toBe(true);
  });

  it("refuses a range that ends before it starts", () => {
    expect(() => range(4, 2)).toThrow(InvalidPageRangeException);
  });

  it("covers the sheets at its ends and everything between them", () => {
    const pages = range(2, 4);

    expect(pages.covers(PageNumber.of(2))).toBe(true);
    expect(pages.covers(PageNumber.of(3))).toBe(true);
    expect(pages.covers(PageNumber.of(4))).toBe(true);
  });

  it("covers no sheet outside it", () => {
    const pages = range(2, 4);

    expect(pages.covers(PageNumber.of(1))).toBe(false);
    expect(pages.covers(PageNumber.of(5))).toBe(false);
  });

  it("follows the range that ends on the sheet before it starts", () => {
    expect(range(4, 6).follows(range(1, 3))).toBe(true);
  });

  it("does not follow a range it overlaps or leaves a gap after", () => {
    expect(range(4, 6).follows(range(1, 4))).toBe(false);
    expect(range(4, 6).follows(range(1, 2))).toBe(false);
  });

  it("equals another range over the same sheets", () => {
    expect(range(1, 3).equals(range(1, 3))).toBe(true);
    expect(range(1, 3).equals(range(1, 4))).toBe(false);
  });
});
