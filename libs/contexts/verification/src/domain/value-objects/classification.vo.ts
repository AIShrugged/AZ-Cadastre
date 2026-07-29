import type { Confidence } from "./confidence.vo.js";
import { DocumentType } from "./document-type.vo.js";

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

  get isPlaced(): boolean {
    return this.type.isKnown;
  }

  equals(other: Classification): boolean {
    return (
      this.type.equals(other.type) &&
      this.confidence.equals(other.confidence)
    );
  }
}
