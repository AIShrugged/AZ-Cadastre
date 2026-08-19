import { describe, expect, it } from "vitest";

import { InvalidDocumentTypeException } from "../exceptions/index.js";
import { DocumentType } from "./document-type.vo.js";

describe("DocumentType", () => {
  it("accepts any key a profile might define, because the set is open", () => {
    expect(DocumentType.create("passport").value).toBe("passport");
    expect(DocumentType.create("cadastral_extract").value).toBe(
      "cadastral_extract",
    );
  });

  it("trims the key it was given", () => {
    expect(DocumentType.create("  title_deed \n").value).toBe("title_deed");
  });

  it("refuses an empty key", () => {
    expect(() => DocumentType.create("")).toThrow(InvalidDocumentTypeException);
  });

  it("refuses a key that is nothing but whitespace", () => {
    expect(() => DocumentType.create("   ")).toThrow(InvalidDocumentTypeException);
  });

  it("accepts a key of exactly the greatest length", () => {
    const longest = "a".repeat(DocumentType.MAX_LENGTH);

    expect(DocumentType.create(longest).value).toBe(longest);
  });

  it("measures the length after trimming", () => {
    const longest = "a".repeat(DocumentType.MAX_LENGTH);

    expect(DocumentType.create(`  ${longest}  `).value).toBe(longest);
  });

  it("refuses a key longer than the greatest length", () => {
    expect(() =>
      DocumentType.create("a".repeat(DocumentType.MAX_LENGTH + 1)),
    ).toThrow(InvalidDocumentTypeException);
  });

  it("says why it refuses", () => {
    expect(() => DocumentType.create(" ")).toThrow(/must not be empty/);
    expect(() =>
      DocumentType.create("a".repeat(DocumentType.MAX_LENGTH + 1)),
    ).toThrow(/must not be too long/);
  });

  it("reads a document the classifier could not place as a value, not as nothing", () => {
    expect(DocumentType.UNKNOWN.value).toBe("unknown");
  });

  it("hands back the one unknown instance when it reads that key back", () => {
    expect(DocumentType.create("unknown")).toBe(DocumentType.UNKNOWN);
    expect(DocumentType.create("  unknown  ")).toBe(DocumentType.UNKNOWN);
  });

  it("knows a type the classifier placed", () => {
    expect(DocumentType.create("passport").isKnown).toBe(true);
  });

  it("does not know a document the classifier could not place", () => {
    expect(DocumentType.UNKNOWN.isKnown).toBe(false);
    expect(DocumentType.create("unknown").isKnown).toBe(false);
  });

  it("is equal to another type of the same key", () => {
    expect(DocumentType.create("passport").equals(DocumentType.create("passport"))).toBe(
      true,
    );
    expect(
      DocumentType.create("passport").equals(DocumentType.create("title_deed")),
    ).toBe(false);
  });
});
