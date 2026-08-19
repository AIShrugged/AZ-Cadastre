import { describe, expect, it } from "vitest";

import { InvalidCrossCheckVerdictException } from "../exceptions/index.js";
import { CrossCheckVerdict } from "./cross-check-verdict.vo.js";

describe("CrossCheckVerdict", () => {
  it("reads back every verdict it can be stored as", () => {
    for (const verdict of CrossCheckVerdict.all) {
      expect(CrossCheckVerdict.of(verdict.value)).toBe(verdict);
    }
  });

  it("refuses a word that is not a verdict", () => {
    expect(() => CrossCheckVerdict.of("probably")).toThrow(
      InvalidCrossCheckVerdictException,
    );
  });

  it("takes only an agreement as an agreement", () => {
    expect(CrossCheckVerdict.MATCH.agrees).toBe(true);
    expect(CrossCheckVerdict.MISMATCH.agrees).toBe(false);
    expect(CrossCheckVerdict.UNCLEAR.agrees).toBe(false);
  });

  it("sends a check nobody could decide to the inspector, like a disagreement", () => {
    expect(CrossCheckVerdict.UNCLEAR.needsInspector).toBe(true);
    expect(CrossCheckVerdict.MISMATCH.needsInspector).toBe(true);
    expect(CrossCheckVerdict.MATCH.needsInspector).toBe(false);
  });
});
