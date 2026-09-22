import { Confidence } from './confidence.vo.js';
import { RecognisedText } from './recognised-text.vo.js';

export class OcrResult {
  private constructor(
    public readonly text: RecognisedText,
    public readonly confidence: Confidence,
    /*
     * The QR codes decoded off the same sheet, in the order they were found
     * (ADR-0034).
     *
     * Here rather than on the page beside the transcription because both are
     * the one thing — what a machine got off this sheet — written once, read
     * back once, and gone together when the sheet is read again. They differ in
     * what they are worth, and that difference is the reason the codes have no
     * confidence of their own: a QR symbol carries its own error correction, so
     * a payload either came back whole or did not come back.
     */
    public readonly codes: readonly string[],
  ) {}

  static of(
    text: RecognisedText,
    confidence: Confidence,
    codes: readonly string[] = [],
  ): OcrResult {
    return new OcrResult(text, confidence, OcrResult.codesOf(codes));
  }

  static illegible(): OcrResult {
    return new OcrResult(RecognisedText.empty(), Confidence.none(), []);
  }

  get isLegible(): boolean {
    return !this.text.isEmpty;
  }

  // The same reading, with what the decoder got off the sheet. A separate step
  // because the two are produced by two ports: the transcription is asked of a
  // reader that may refuse it, and the codes of a decoder that cannot.
  withCodes(codes: readonly string[]): OcrResult {
    return new OcrResult(this.text, this.confidence, OcrResult.codesOf(codes));
  }

  equals(other: OcrResult): boolean {
    return (
      this.text.equals(other.text) &&
      this.confidence.equals(other.confidence) &&
      this.codes.length === other.codes.length &&
      this.codes.every((code, index) => code === other.codes[index])
    );
  }

  // Trimmed, emptied of blanks and deduplicated: the same symbol found twice —
  // by two passes over one sheet, or on two sheets of one paper — is one code,
  // and a caller counting references must not see it as two.
  private static codesOf(codes: readonly string[]): readonly string[] {
    return [
      ...new Set(
        codes.map(code => code.trim()).filter(code => code.length > 0),
      ),
    ];
  }
}
