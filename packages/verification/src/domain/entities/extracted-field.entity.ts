import type {
  Confidence,
  FieldKey,
  FieldValue,
  PageNumber,
} from '../value-objects/index.js';

export class ExtractedField {
  private constructor(
    public readonly key: FieldKey,
    public readonly value: FieldValue,
    public readonly confidence: Confidence,
    public readonly foundOn: PageNumber,
  ) {}

  static of(
    key: FieldKey,
    value: FieldValue,
    confidence: Confidence,
    foundOn: PageNumber,
  ): ExtractedField {
    return new ExtractedField(key, value, confidence, foundOn);
  }

  isBelow(threshold: Confidence): boolean {
    return this.confidence.isBelow(threshold);
  }
}
