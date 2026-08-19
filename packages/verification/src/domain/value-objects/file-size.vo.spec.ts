import { describe, expect, it } from "vitest";

import {
  FileTooLargeException,
  InvalidFileSizeException,
} from "../exceptions/index.js";
import { FileSize } from "./file-size.vo.js";

describe("FileSize", () => {
  it("keeps the byte count it was given", () => {
    expect(FileSize.of(2_600_000).value).toBe(2_600_000);
  });

  it("accepts a file of exactly the greatest size", () => {
    expect(FileSize.of(FileSize.MAX_BYTES).value).toBe(FileSize.MAX_BYTES);
  });

  it("refuses a file larger than the greatest size", () => {
    expect(() => FileSize.of(FileSize.MAX_BYTES + 1)).toThrow(
      FileTooLargeException,
    );
  });

  it("refuses an empty file", () => {
    expect(() => FileSize.of(0)).toThrow(InvalidFileSizeException);
  });

  it("refuses a negative size", () => {
    expect(() => FileSize.of(-1)).toThrow(InvalidFileSizeException);
  });

  it("refuses a fractional byte count", () => {
    expect(() => FileSize.of(1.5)).toThrow(InvalidFileSizeException);
  });

  it("says how large a file may be", () => {
    expect(() => FileSize.of(FileSize.MAX_BYTES + 1)).toThrow(/at most 50 MB/);
  });
});
