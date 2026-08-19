import type { Confidence } from './confidence.vo.js';
import { DocumentType } from './document-type.vo.js';

export class Classification {
  private constructor(
    public readonly type: DocumentType,
    public readonly confidence: Confidence,
  ) {}

  static of(type: DocumentType, confidence: Confidence): Classification {
    return new Classification(type, confidence);
  }

  static unplaced(confidence: Confidence): Classification {
    return new Classification(DocumentType.UNKNOWN, confidence);
  }

  // Read, and read as something the profile does not ask for.
  static outOfProfile(confidence: Confidence): Classification {
    return new Classification(DocumentType.OUT_OF_PROFILE, confidence);
  }

  // Placed under a type of the profile's own — the only outcome that answers a
  // requirement and the only one with fields to extract.
  get isPlaced(): boolean {
    return this.type.isKnown;
  }

  get isOutOfProfile(): boolean {
    return this.type.isOutOfProfile;
  }

  equals(other: Classification): boolean {
    return (
      this.type.equals(other.type) && this.confidence.equals(other.confidence)
    );
  }
}
