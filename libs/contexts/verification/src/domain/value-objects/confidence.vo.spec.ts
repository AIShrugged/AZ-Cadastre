import { describe, expect, it } from "vitest";

import { InvalidConfidenceException } from "../exceptions/index.js";
import { Confidence } from "./confidence.vo.js";

describe("Confidence", () => {
  it("accepts a number anywhere in 0..1", () => {
    expect(Confidence.of(0.42).value).toBe(0.42);
  });

  it("accepts both ends of the range", () => {
    expect(Confidence.of(0).value).toBe(0);
    expect(Confidence.of(1).value).toBe(1);
  });

  it("refuses a confidence below nothing", () => {
    expect(() => Confidence.of(-0.01)).toThrow(InvalidConfidenceException);
  });

  it("refuses a confidence above certainty", () => {
    expect(() => Confidence.of(1.01)).toThrow(InvalidConfidenceException);
  });

  it("refuses a confidence that is not a number at all", () => {
    expect(() => Confidence.of(Number.NaN)).toThrow(InvalidConfidenceException);
    expect(() => Confidence.of(Number.POSITIVE_INFINITY)).toThrow(
      InvalidConfidenceException,
    );
  });

  it("reports what it was handed when it refuses", () => {
    expect(() => Confidence.of(7)).toThrow(/received 7/);
  });

  it("reads nothing recognised as zero, which is an outcome and not an error", () => {
    expect(Confidence.none().value).toBe(0);
  });

  it("meets a threshold it sits above", () => {
    expect(Confidence.of(0.9).meets(Confidence.of(0.6))).toBe(true);
  });

  it("meets a threshold it sits exactly on", () => {
    expect(Confidence.of(0.6).meets(Confidence.of(0.6))).toBe(true);
  });

  it("does not meet a threshold it sits below", () => {
    expect(Confidence.of(0.59).meets(Confidence.of(0.6))).toBe(false);
  });

  it("is below a threshold exactly when it does not meet it", () => {
    const threshold = Confidence.of(0.6);

    expect(Confidence.of(0.59).isBelow(threshold)).toBe(true);
    expect(Confidence.of(0.6).isBelow(threshold)).toBe(false);
    expect(Confidence.of(0.9).isBelow(threshold)).toBe(false);
  });

  it("counts nothing recognised as below any threshold worth having", () => {
    expect(Confidence.none().isBelow(Confidence.of(0.6))).toBe(true);
  });

  it("is equal to another confidence of the same number", () => {
    expect(Confidence.of(0.5).equals(Confidence.of(0.5))).toBe(true);
    expect(Confidence.none().equals(Confidence.of(0))).toBe(true);
  });

  it("differs from another number", () => {
    expect(Confidence.of(0.5).equals(Confidence.of(0.51))).toBe(false);
  });
});
