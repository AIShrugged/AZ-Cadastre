import { InvalidFilenameException } from "../exceptions/index.js";

export class Filename {
  static readonly MAX_LENGTH = 255;

  private constructor(public readonly value: string) {}

  static create(raw: string): Filename {
    const trimmed = raw.trim();

    if (trimmed.length === 0) throw new InvalidFilenameException("empty");
    if (trimmed.length > Filename.MAX_LENGTH) {
      throw new InvalidFilenameException("too_long");
    }

    return new Filename(trimmed);
  }

  equals(other: Filename): boolean {
    return this.value === other.value;
  }
}
