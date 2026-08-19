import {
  FileTooLargeException,
  InvalidFileSizeException,
} from "../exceptions/index.js";

export class FileSize {
  static readonly MAX_BYTES = 50 * 1024 * 1024;

  private constructor(public readonly value: number) {}

  static of(bytes: number): FileSize {
    if (!Number.isInteger(bytes) || bytes <= 0) {
      throw new InvalidFileSizeException(bytes);
    }
    if (bytes > FileSize.MAX_BYTES) {
      throw new FileTooLargeException(bytes, FileSize.MAX_BYTES);
    }

    return new FileSize(bytes);
  }
}
