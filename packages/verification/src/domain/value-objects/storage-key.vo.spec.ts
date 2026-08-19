import { describe, expect, it } from "vitest";

import { InvalidStorageKeyException } from "../exceptions/index.js";
import { StorageKey } from "./storage-key.vo.js";

describe("StorageKey", () => {
  it("names where the bytes live without ever reading them", () => {
    expect(StorageKey.create("uploads/2026/07/passport.pdf").value).toBe(
      "uploads/2026/07/passport.pdf",
    );
  });

  it("trims the key it was given", () => {
    expect(StorageKey.create("  uploads/a.pdf \n").value).toBe(
      "uploads/a.pdf",
    );
  });

  it("refuses an empty key", () => {
    expect(() => StorageKey.create("")).toThrow(InvalidStorageKeyException);
  });

  it("refuses a key that is nothing but whitespace", () => {
    expect(() => StorageKey.create("  ")).toThrow(InvalidStorageKeyException);
  });

  it("accepts a key of exactly the greatest length", () => {
    const longest = "a".repeat(StorageKey.MAX_LENGTH);

    expect(StorageKey.create(longest).value).toBe(longest);
  });

  it("refuses a key longer than the greatest length", () => {
    expect(() =>
      StorageKey.create("a".repeat(StorageKey.MAX_LENGTH + 1)),
    ).toThrow(InvalidStorageKeyException);
  });

  it("says why it refuses", () => {
    expect(() => StorageKey.create("")).toThrow(/must not be empty/);
    expect(() =>
      StorageKey.create("a".repeat(StorageKey.MAX_LENGTH + 1)),
    ).toThrow(/must not be too long/);
  });

  it("is equal to another key pointing at the same object", () => {
    expect(
      StorageKey.create("uploads/a.pdf").equals(
        StorageKey.create(" uploads/a.pdf "),
      ),
    ).toBe(true);
    expect(
      StorageKey.create("uploads/a.pdf").equals(
        StorageKey.create("uploads/b.pdf"),
      ),
    ).toBe(false);
  });
});
