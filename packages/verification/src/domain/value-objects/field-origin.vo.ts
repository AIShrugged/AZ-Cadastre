import { InvalidFieldOriginException } from '../exceptions/index.js';

import type { DocumentType } from './document-type.vo.js';
import type { DocumentId } from './entity-ids/index.js';
import type { FieldKey } from './field.vo.js';
import type { PageNumber } from './page-number.vo.js';

/**
 * Where an extracted field's value came from.
 *
 * Until now there was one answer and it was implicit: a field on a document was
 * read off that document, and nothing else could be. Two things the engine
 * already does made that untrue — a value the package prints on five papers can
 * close a field the sixth did not yield, and a value the archive register holds
 * the same record of has been confirmed by something outside the envelope. Both
 * are worth telling an inspector, and neither is "read here".
 *
 * Stated as an origin and never as a flag, because they are not degrees of one
 * thing: a reading is evidence about *this* paper, a value carried over is
 * evidence about the package, a confirmation is evidence from outside it, and
 * a value an operator typed is a person's reading of the paper in their hand.
 * A boolean would collapse all but the first into "not quite read".
 */
export class FieldOrigin {
  // Read off this document, cited to a sheet of it. What every field was before
  // this existed, and what most of them still are.
  static readonly READ_ON_THIS_DOCUMENT = new FieldOrigin('ReadOnThisDocument');
  // The same value another paper of this package states, carried over because
  // the profile's cross-checks say the two papers print one value and this one
  // did not yield it. It says nothing about what is printed here — which is
  // exactly why it is marked rather than passed off as a reading.
  static readonly TAKEN_FROM_ANOTHER_DOCUMENT = new FieldOrigin(
    'TakenFromAnotherDocument',
  );
  // Read off this document *and* matched by the archive register's record of
  // the property. Still a reading of this paper: the register agreed with it,
  // it did not supply it.
  static readonly CONFIRMED_BY_REGISTRY = new FieldOrigin(
    'ConfirmedByRegistry',
  );
  /*
   * Typed by an operator off the paper in front of them, because the reader got
   * it wrong or never got it at all.
   *
   * A reading of this document and answering `wasReadHere` with `true` — which
   * is the whole point of it. A person read the paper, so the value may be a
   * side of a cross-document check, may be what the register is asked about,
   * and answers for the document it hangs on. Were it anything else, the
   * correction would change nothing downstream and an operator would be typing
   * into a box that does nothing (COMM-122).
   */
  static readonly ENTERED_BY_OPERATOR = new FieldOrigin('EnteredByOperator');

  private constructor(public readonly value: string) {}

  static get all(): readonly FieldOrigin[] {
    return [
      FieldOrigin.READ_ON_THIS_DOCUMENT,
      FieldOrigin.TAKEN_FROM_ANOTHER_DOCUMENT,
      FieldOrigin.CONFIRMED_BY_REGISTRY,
      FieldOrigin.ENTERED_BY_OPERATOR,
    ];
  }

  static of(raw: string): FieldOrigin {
    const found = FieldOrigin.all.find(candidate => candidate.value === raw);

    if (!found) throw new InvalidFieldOriginException(raw);

    return found;
  }

  /*
   * Whether the value was read off the document it hangs on.
   *
   * The one question every rule downstream asks, and the reason it is asked
   * here rather than by comparing against a member: a value that was not read
   * here is not this paper stating anything, so it may not answer a
   * cross-check, may not be what the register is asked about, and is not a
   * reading anybody can be told was poor. A fourth origin was added later, and
   * answering this question here is what made that unavoidable: an operator's
   * own value answers `true`, because a person read the paper (COMM-122).
   */
  get wasReadHere(): boolean {
    return !this.equals(FieldOrigin.TAKEN_FROM_ANOTHER_DOCUMENT);
  }

  /*
   * Whether a machine read this value, as against a person having typed it.
   *
   * The question the extraction stage asks before it skips a document it takes
   * to be done with. A document whose only values an operator entered has not
   * been read by anything, and counting those as a reading would make one
   * correction cancel, for good, the reading of every other field on that
   * paper (COMM-122).
   */
  get wasReadByTheMachine(): boolean {
    return this.wasReadHere && !this.equals(FieldOrigin.ENTERED_BY_OPERATOR);
  }

  // Whether a person put this value here. Asked where the machine's own reading
  // must not be allowed to write over a correction.
  get wasEnteredByOperator(): boolean {
    return this.equals(FieldOrigin.ENTERED_BY_OPERATOR);
  }

  equals(other: FieldOrigin): boolean {
    return this.value === other.value;
  }
}

/**
 * The reading a carried-over value was copied from: which document of the
 * package, which of its fields, and the sheet **of that document** it is
 * printed on.
 *
 * The sheet lives here and not beside the field's own page number on purpose. A
 * client opens a field's `foundOn` as a sheet of the document the field hangs
 * on; a source's sheet belongs to a different document, and putting one number
 * where the other is expected would send an inspector to the wrong paper —
 * which is worse than showing them nothing.
 */
export class FieldSource {
  private constructor(
    public readonly documentId: DocumentId,
    public readonly documentType: DocumentType,
    public readonly fieldKey: FieldKey,
    public readonly foundOn: PageNumber,
  ) {}

  static of(state: {
    documentId: DocumentId;
    documentType: DocumentType;
    fieldKey: FieldKey;
    foundOn: PageNumber;
  }): FieldSource {
    return new FieldSource(
      state.documentId,
      state.documentType,
      state.fieldKey,
      state.foundOn,
    );
  }

  // The audit line's way of naming where a value came from, written once in
  // English like every other citation.
  get cited(): string {
    return (
      `${this.documentType.value}.${this.fieldKey.value} ` +
      `(p.${this.foundOn.value})`
    );
  }
}
