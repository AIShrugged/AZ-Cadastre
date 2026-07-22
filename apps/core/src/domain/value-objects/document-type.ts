/**
 * Document Type — the recognized category of a Document.
 *
 * Concrete types (Passport, Driver License, …) come from the active
 * Verification Profile; `Unknown` is the only name the domain itself knows.
 */
export class DocumentType {
  static readonly UNKNOWN_NAME = "Unknown";

  private constructor(public readonly name: string) {}

  static of(name: string): DocumentType {
    if (name.trim().length === 0) {
      throw new Error("Document Type name cannot be empty.");
    }
    return new DocumentType(name);
  }

  static unknown(): DocumentType {
    return new DocumentType(DocumentType.UNKNOWN_NAME);
  }

  get isUnknown(): boolean {
    return this.name === DocumentType.UNKNOWN_NAME;
  }

  equals(other: DocumentType): boolean {
    return this.name === other.name;
  }
}
