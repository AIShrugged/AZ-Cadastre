import { Confidence } from "./confidence.js";

/**
 * Page — a single image derived from a Document; the unit sent to OCR.
 *
 * Immutable: recording OCR produces a new Page value rather than mutating
 * this one. The domain holds only the object-storage reference, never bytes.
 */
export class Page {
  private constructor(
    public readonly number: number,
    public readonly imageRef: string,
    public readonly text?: string,
    public readonly confidence?: Confidence,
  ) {}

  static create(number: number, imageRef: string): Page {
    if (!Number.isInteger(number) || number <= 0) {
      throw new Error("Page number must be a positive integer.");
    }
    if (imageRef.trim().length === 0) {
      throw new Error("Page must reference a stored image.");
    }
    return new Page(number, imageRef);
  }

  /** Return a copy of this Page carrying its OCR result. */
  withOcr(text: string, confidence: Confidence): Page {
    return new Page(this.number, this.imageRef, text, confidence);
  }

  get isRecognized(): boolean {
    return this.text !== undefined;
  }
}
