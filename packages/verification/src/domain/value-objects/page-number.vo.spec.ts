import { describe, expect, it } from "vitest";

import { InvalidPageNumberException } from "../exceptions/index.js";
import { PageNumber } from "./page-number.vo.js";

describe("PageNumber", () => {
  it("counts sheets from one", () => {
    expect(PageNumber.of(1).value).toBe(1);
    expect(PageNumber.of(17).value).toBe(17);
  });

  it("refuses a page before the first", () => {
    expect(() => PageNumber.of(0)).toThrow(InvalidPageNumberException);
    expect(() => PageNumber.of(-1)).toThrow(InvalidPageNumberException);
  });

  it("refuses a page between two sheets", () => {
    expect(() => PageNumber.of(1.5)).toThrow(InvalidPageNumberException);
  });

  it("refuses a page number that is not a number at all", () => {
    expect(() => PageNumber.of(Number.NaN)).toThrow(InvalidPageNumberException);
    expect(() => PageNumber.of(Number.POSITIVE_INFINITY)).toThrow(
      InvalidPageNumberException,
    );
  });

  it("says what it was handed when it refuses", () => {
    expect(() => PageNumber.of(0)).toThrow(/received 0/);
  });

  it("reads the single sheet of a document that was never split as the first", () => {
    expect(PageNumber.first().value).toBe(1);
  });

  it("counts on to the following sheet", () => {
    expect(PageNumber.first().next().value).toBe(2);
    expect(PageNumber.of(9).next().value).toBe(10);
  });

  it("leaves the sheet it counted on from alone", () => {
    const first = PageNumber.first();

    first.next();

    expect(first.value).toBe(1);
  });

  it("is equal to another page number for the same sheet", () => {
    expect(PageNumber.of(1).equals(PageNumber.first())).toBe(true);
    expect(PageNumber.of(1).equals(PageNumber.of(2))).toBe(false);
  });
});
