import { Confidence } from "./confidence.js";

/** Extracted Field — a single structured value pulled from a Document. */
export class ExtractedField {
  private constructor(
    public readonly name: string,
    public readonly value: string,
    public readonly confidence: Confidence,
    public readonly page: number,
  ) {}

  static create(name: string, value: string, confidence: Confidence, page: number): ExtractedField {
    if (name.trim().length === 0) {
      throw new Error("Extracted Field name cannot be empty.");
    }
    if (!Number.isInteger(page) || page <= 0) {
      throw new Error("Extracted Field must reference a positive page number.");
    }
    return new ExtractedField(name, value, confidence, page);
  }
}
