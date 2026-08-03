import { InvalidDocumentTypeException } from "../exceptions/index.js";

export class DocumentType {
  // The reader could not tell what this is: the sheets came back damaged, or
  // nothing about them says what record they are.
  static readonly UNKNOWN = new DocumentType("unknown");

  // The reader could tell perfectly well, and the answer is a document the
  // active profile does not ask for — a service sheet of the registry's own, a
  // courier waybill, a contract drawn up after the fact. It is not a failure of
  // reading, and telling the inspector "could not be read" about a document
  // that read fine is the wrong thing to say about it.
  static readonly OUT_OF_PROFILE = new DocumentType("out_of_profile");

  static readonly MAX_LENGTH = 64;

  private constructor(public readonly value: string) {}

  static create(raw: string): DocumentType {
    const trimmed = raw.trim();

    if (trimmed.length === 0) throw new InvalidDocumentTypeException("empty");
    if (trimmed.length > DocumentType.MAX_LENGTH) {
      throw new InvalidDocumentTypeException("too_long");
    }

    const reserved = [DocumentType.UNKNOWN, DocumentType.OUT_OF_PROFILE].find(
      (type) => type.value === trimmed,
    );

    return reserved ?? new DocumentType(trimmed);
  }

  // A type of the profile's own, as opposed to either of the two answers the
  // engine keeps for itself. Only these satisfy a requirement or carry fields.
  get isKnown(): boolean {
    return !this.equals(DocumentType.UNKNOWN) && !this.isOutOfProfile;
  }

  get isOutOfProfile(): boolean {
    return this.equals(DocumentType.OUT_OF_PROFILE);
  }

  equals(other: DocumentType): boolean {
    return this.value === other.value;
  }
}
