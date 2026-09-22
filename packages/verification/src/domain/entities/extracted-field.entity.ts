import {
  Confidence,
  FieldOrigin,
  FieldSource,
  type CheckedValue,
  type EditorAccountId,
  type FieldKey,
  type FieldValue,
  type PageNumber,
} from '../value-objects/index.js';

/*
 * What a value carried over from another paper is worth, as a share of the
 * reading it was copied from.
 *
 * A discount and never a promotion: the same value printed on a sister document
 * is evidence about the package and no evidence at all about this sheet, so it
 * can never be surer than the reading it came out of. That it is *less* sure
 * than that reading is the second half of the same thought — the source says
 * what the source says, and this says only that the package is consistent about
 * it.
 *
 * Set clear of `Confidence.FLOOR` on purpose. A factor small enough to push a
 * perfectly read source under the floor would make "is this value doubted"
 * turn on this constant rather than on how the paper was read, and the floor
 * would then be describing the copying instead of the reading.
 */
const CARRIED_OVER = 0.9;

/**
 * One value the pipeline holds against a document — and, since it can now come
 * from somewhere other than that document, where it came from.
 *
 * `foundOn` is the sheet **of this document** the value is printed on, and it
 * is null exactly when the value was not read on this document at all. Null and
 * not the source's sheet number: a client turns `foundOn` into a page of the
 * document the field hangs on, and a foreign number there would open the wrong
 * paper — a mistake worse than showing no page at all. Where the value came off
 * another document, that document and its sheet are in `takenFrom`.
 */
export class ExtractedField {
  private constructor(
    public readonly key: FieldKey,
    public readonly value: FieldValue,
    public readonly confidence: Confidence,
    public readonly foundOn: PageNumber | null,
    public readonly origin: FieldOrigin,
    public readonly takenFrom: FieldSource | null,
    // Who last corrected this value by hand, and when. Both null on every field
    // nobody has touched, which is nearly all of them (COMM-122).
    public readonly editedBy: EditorAccountId | null,
    public readonly editedAt: Date | null,
  ) {}

  // Read off this document, on this sheet of it. The extraction stage's only
  // way of making one, and the shape every field had before an origin existed.
  static of(
    key: FieldKey,
    value: FieldValue,
    confidence: Confidence,
    foundOn: PageNumber,
  ): ExtractedField {
    return new ExtractedField(
      key,
      value,
      confidence,
      foundOn,
      FieldOrigin.READ_ON_THIS_DOCUMENT,
      null,
      null,
      null,
    );
  }

  /**
   * A value a machine decoded off the sheet rather than read off it — today the
   * one `qr_code` line, taken from the QR symbol itself (ADR-0034).
   *
   * The confidence is 1 and is set here rather than taken, for the same reason
   * an operator's correction is: a QR symbol carries its own error correction,
   * so a payload came back whole or did not come back. There is no probability
   * to attach, and letting a caller attach one would put a value that cannot be
   * misread into the report's low-confidence findings.
   *
   * The origin is `ReadOnThisDocument` and not one of its own: it was read on
   * this document, off this sheet, which is the whole of what the origin
   * records and what everything downstream asks it.
   */
  static decodedOnThisDocument(
    key: FieldKey,
    value: FieldValue,
    foundOn: PageNumber,
  ): ExtractedField {
    return new ExtractedField(
      key,
      value,
      Confidence.of(1),
      foundOn,
      FieldOrigin.READ_ON_THIS_DOCUMENT,
      null,
      null,
      null,
    );
  }

  /**
   * What an operator typed off the paper in front of them, because the reader
   * got this field wrong or never got it at all.
   *
   * The confidence is 1 and is set here rather than taken, because a figure a
   * person read off the sheet is not a reading with a probability attached.
   * That is not a flourish: it is what keeps a correction out of the report's
   * low-confidence findings, where it would send an inspector to look again at
   * the one value somebody has already looked at.
   *
   * `foundOn` is the sheet of the field it replaces, where it replaces one, and
   * null where the operator states a value nothing was read for — the same rule
   * as any other origin that was read here, since there is no sheet to cite
   * when nothing was read.
   */
  static enteredByOperator(
    key: FieldKey,
    value: FieldValue,
    foundOn: PageNumber | null,
    by: EditorAccountId,
    at: Date,
  ): ExtractedField {
    return new ExtractedField(
      key,
      value,
      Confidence.of(1),
      foundOn,
      FieldOrigin.ENTERED_BY_OPERATOR,
      null,
      by,
      at,
    );
  }

  /**
   * The same value another paper of the package states, carried over to close a
   * field this one did not yield.
   *
   * The discount is applied here and nowhere else, so no caller can hand a
   * carried-over value the confidence of a reading it is not.
   */
  static takenFrom(key: FieldKey, read: CheckedValue): ExtractedField {
    return new ExtractedField(
      key,
      read.value,
      Confidence.of(read.confidence.value * CARRIED_OVER),
      null,
      FieldOrigin.TAKEN_FROM_ANOTHER_DOCUMENT,
      FieldSource.of({
        documentId: read.documentId,
        documentType: read.documentType,
        fieldKey: read.fieldKey,
        foundOn: read.foundOn,
      }),
      null,
      null,
    );
  }

  static restore(state: {
    key: FieldKey;
    value: FieldValue;
    confidence: Confidence;
    foundOn: PageNumber | null;
    origin: FieldOrigin;
    takenFrom: FieldSource | null;
    editedBy?: EditorAccountId | null;
    editedAt?: Date | null;
  }): ExtractedField {
    return new ExtractedField(
      state.key,
      state.value,
      state.confidence,
      state.foundOn,
      state.origin,
      state.takenFrom,
      state.editedBy ?? null,
      state.editedAt ?? null,
    );
  }

  /*
   * The same reading, with the archive register's agreement recorded on it.
   *
   * The value and the confidence are untouched: the register agreed with what
   * this paper says, it did not read the paper better than the reader did. A
   * value carried over from elsewhere is refused the mark, because the register
   * was asked about the paper that states it and the answer belongs there.
   *
   * A value an operator entered is left exactly as it is, mark and all. The
   * origin records where the value came from, and where it came from is a
   * person; the register's agreement is already recorded on the registry check
   * that asked, and overwriting the origin with it would lose the one fact an
   * inspector most needs about that field — that it is not what the machine
   * read (COMM-122).
   */
  confirmedByRegistry(): ExtractedField {
    if (!this.origin.wasReadHere) return this;
    if (this.origin.wasEnteredByOperator) return this;

    return new ExtractedField(
      this.key,
      this.value,
      this.confidence,
      this.foundOn,
      FieldOrigin.CONFIRMED_BY_REGISTRY,
      this.takenFrom,
      this.editedBy,
      this.editedAt,
    );
  }

  // Whether this document is what the value was read off. Everything that
  // reasons about what a paper states asks this first: a carried-over value is
  // the package speaking, not this sheet.
  get wasReadHere(): boolean {
    return this.origin.wasReadHere;
  }

  // Whether a machine read this value. What "already extracted" means: a value
  // an operator typed is not this paper having been read (COMM-122).
  get wasReadByTheMachine(): boolean {
    return this.origin.wasReadByTheMachine;
  }

  // Whether a person put this value here, and so whether the extraction stage
  // must leave it alone.
  get wasEnteredByOperator(): boolean {
    return this.origin.wasEnteredByOperator;
  }

  isBelow(threshold: Confidence): boolean {
    return this.confidence.isBelow(threshold);
  }
}
