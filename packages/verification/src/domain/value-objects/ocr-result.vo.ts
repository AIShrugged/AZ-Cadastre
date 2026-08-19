import { Confidence } from "./confidence.vo.js";
import { RecognisedText } from "./recognised-text.vo.js";

export class OcrResult {
  private constructor(
    public readonly text: RecognisedText,
    public readonly confidence: Confidence,
  ) {}

  static of(text: RecognisedText, confidence: Confidence): OcrResult {
    return new OcrResult(text, confidence);
  }

  static illegible(): OcrResult {
    return new OcrResult(RecognisedText.empty(), Confidence.none());
  }

  get isLegible(): boolean {
    return !this.text.isEmpty;
  }

  equals(other: OcrResult): boolean {
    return (
      this.text.equals(other.text) && this.confidence.equals(other.confidence)
    );
  }
}
