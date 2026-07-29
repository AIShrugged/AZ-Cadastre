import { describe, expect, it } from "vitest";

import {
  Confidence,
  FieldKey,
  FieldValue,
  PageNumber,
} from "../value-objects/index.js";
import { ExtractedField } from "./extracted-field.entity.js";

function aField(confidence: Confidence, key = "passport_no"): ExtractedField {
  return ExtractedField.of(
    FieldKey.create(key),
    FieldValue.create("AZE1234567"),
    confidence,
    PageNumber.first(),
  );
}

describe("ExtractedField", () => {
  it("carries the key it answers, the value pulled, how sure the extractor was and where it was read", () => {
    const field = ExtractedField.of(
      FieldKey.create("parcel_id"),
      FieldValue.create("AZ-01-234"),
      Confidence.of(0.81),
      PageNumber.of(2),
    );

    expect(field.key.equals(FieldKey.create("parcel_id"))).toBe(true);
    expect(field.value.equals(FieldValue.create("AZ-01-234"))).toBe(true);
    expect(field.confidence.value).toBe(0.81);
    expect(field.foundOn.equals(PageNumber.of(2))).toBe(true);
  });

  it("warns the inspector about a value the extractor was unsure of", () => {
    expect(aField(Confidence.of(0.4)).isBelow(Confidence.of(0.6))).toBe(true);
  });

  it("does not warn about a value the extractor was sure enough of", () => {
    expect(aField(Confidence.of(0.9)).isBelow(Confidence.of(0.6))).toBe(false);
  });

  it("does not warn about a value sitting exactly on the threshold", () => {
    expect(aField(Confidence.of(0.6)).isBelow(Confidence.of(0.6))).toBe(false);
  });

  it("always warns about a value the extractor had no confidence in", () => {
    expect(aField(Confidence.none()).isBelow(Confidence.of(0.01))).toBe(true);
  });
});
