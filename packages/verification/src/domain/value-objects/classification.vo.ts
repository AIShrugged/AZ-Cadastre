import type { Confidence } from './confidence.vo.js';
import { DocumentType } from './document-type.vo.js';

export class Classification {
  private constructor(
    public readonly type: DocumentType,
    public readonly confidence: Confidence,
    // Which entry of the document catalogue this was recognised as, on a
    // reading that is out of profile and was recognised as one of the papers
    // that keep turning up beside the profile's own. Null on every other
    // reading, and null on an out-of-profile document the catalogue has no
    // name for (ADR-0012).
    public readonly knownAs: DocumentType | null,
  ) {}

  static of(type: DocumentType, confidence: Confidence): Classification {
    return new Classification(type, confidence, null);
  }

  static unplaced(confidence: Confidence): Classification {
    return new Classification(DocumentType.UNKNOWN, confidence, null);
  }

  // Read, and read as something the profile does not ask for.
  static outOfProfile(
    confidence: Confidence,
    knownAs: DocumentType | null = null,
  ): Classification {
    return new Classification(DocumentType.OUT_OF_PROFILE, confidence, knownAs);
  }

  // Placed under a type of the profile's own — the only outcome that answers a
  // requirement and the only one with fields to extract.
  get isPlaced(): boolean {
    return this.type.isKnown;
  }

  get isOutOfProfile(): boolean {
    return this.type.isOutOfProfile;
  }

  // The document has a name of its own, rather than only the bucket it fell
  // into. What the report says about it turns on this and nothing else.
  get isNamed(): boolean {
    return this.knownAs !== null;
  }

  equals(other: Classification): boolean {
    return (
      this.type.equals(other.type) &&
      this.confidence.equals(other.confidence) &&
      this.namesTheSameAs(other)
    );
  }

  private namesTheSameAs(other: Classification): boolean {
    if (this.knownAs === null || other.knownAs === null) {
      return this.knownAs === other.knownAs;
    }

    return this.knownAs.equals(other.knownAs);
  }
}
