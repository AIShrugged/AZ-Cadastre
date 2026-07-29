import { InvalidDocumentTypeException } from "../exceptions/index.js";

export class DocumentType {
  static readonly UNKNOWN = new DocumentType("unknown");

  static readonly MAX_LENGTH = 64;

  private constructor(public readonly value: string) {}

  static create(raw: string): DocumentType {
    const trimmed = raw.trim();

    if (trimmed.length === 0) throw new InvalidDocumentTypeException("empty");
    if (trimmed.length > DocumentType.MAX_LENGTH) {
      throw new InvalidDocumentTypeException("too_long");
    }

    return trimmed === DocumentType.UNKNOWN.value
      ? DocumentType.UNKNOWN
      : new DocumentType(trimmed);
  }

  get isKnown(): boolean {
    return !this.equals(DocumentType.UNKNOWN);
  }

  equals(other: DocumentType): boolean {
    return this.value === other.value;
  }
}
