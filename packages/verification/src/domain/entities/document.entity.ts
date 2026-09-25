import {
  DocumentAlreadyClassifiedException,
  DocumentNotClassifiedException,
  UnclassifiableDocumentException,
} from '../exceptions/index.js';
import { Supersession } from '../value-objects/index.js';
import type {
  ArchiveQrCheck,
  Classification,
  DocumentId,
  EditorAccountId,
  FieldKey,
  FieldValue,
  PageRange,
  SourceFileId,
  SpanMarkup,
} from '../value-objects/index.js';

import { ExtractedField } from './extracted-field.entity.js';

export class Document {
  readonly #fields: readonly ExtractedField[];

  private constructor(
    public readonly id: DocumentId,
    public readonly sourceFileId: SourceFileId,
    public readonly pages: PageRange,
    public readonly classification: Classification | null,
    fields: readonly ExtractedField[],
    // What pushed this document out of force, and when. Null on every document
    // an operator has not replaced, which is nearly all of them (COMM-80).
    public readonly superseded: Supersession | null,
    // What the National Archive Fund said about this paper, asked by the QR
    // reference printed on it. Null on every paper that is not a Decree 439
    // title, and on one the check has not been made for yet (ADR-0028).
    public readonly archiveQrCheck: ArchiveQrCheck | null,
    /*
     * The span working drawn onto this document's sheets, or null (COMM-165).
     *
     * On a design set once the markup stage has run, and null on every other
     * paper: only the three types a span is read off have anything to draw.
     * Kept on the document rather than beside the calculation because the
     * picture is worth the most when the calculation refused — and then there is
     * no calculation for it to hang on (ADR-0044).
     */
    public readonly spanMarkup: SpanMarkup | null,
  ) {
    this.#fields = [...fields];
  }

  static create(
    id: DocumentId,
    sourceFileId: SourceFileId,
    pages: PageRange,
  ): Document {
    return new Document(id, sourceFileId, pages, null, [], null, null, null);
  }

  static restore(state: {
    id: DocumentId;
    sourceFileId: SourceFileId;
    pages: PageRange;
    classification: Classification | null;
    fields: readonly ExtractedField[];
    superseded?: Supersession | null;
    archiveQrCheck?: ArchiveQrCheck | null;
    spanMarkup?: SpanMarkup | null;
  }): Document {
    return new Document(
      state.id,
      state.sourceFileId,
      state.pages,
      state.classification,
      state.fields,
      state.superseded ?? null,
      state.archiveQrCheck ?? null,
      state.spanMarkup ?? null,
    );
  }

  /*
   * Whether this document is what the package currently says.
   *
   * Everything worked out *about* the package reads only these: the report, the
   * cross-document checks, the questions put to the register, the three values
   * a row names the case by. A document a better scan replaced stays in the
   * package and stays readable — a submission is evidence, not a working draft
   * — but it no longer speaks for it (COMM-80).
   */
  get isInForce(): boolean {
    return this.superseded === null;
  }

  // The same document, pushed out of force by the one that replaced it. The
  // stamp is passed in rather than taken here so that every document a single
  // arrival replaces carries the same instant.
  supersededBy(by: DocumentId, at: Date): Document {
    return this.with({ superseded: Supersession.of(by, at) });
  }

  /*
   * The same document with the values it borrowed from `documentId` dropped.
   *
   * Used when that document goes out of force: a value carried over is nothing
   * but a pointer at the reading that justifies it (ADR-0023), and a pointer at
   * a paper the package no longer speaks for is a value the package no longer
   * states. Dropped rather than rewritten — the next run gathers again, off the
   * document that is now in force, and that is the only place the choice of
   * source is made.
   */
  withoutValuesFrom(documentId: DocumentId): Document {
    const kept = this.#fields.filter(
      field => !field.takenFrom?.documentId.equals(documentId),
    );

    return kept.length === this.#fields.length
      ? this
      : this.with({ fields: kept });
  }

  /*
   * The same document with the value it borrowed from one particular reading
   * dropped — that document's field, and not the whole of that document.
   *
   * The narrower sister of `withoutValuesFrom`, and it has to be narrower: a
   * paper going out of force takes every reading on it with it, but an operator
   * correcting one field leaves the rest of that paper exactly as it was. A
   * pointer at a reading that no longer exists is not a value the package
   * states (ADR-0023), and `gatherFromThePackage` re-derives it off what is now
   * in force — which is the only place the choice of source is ever made
   * (COMM-122).
   */
  withoutValueTakenFrom(documentId: DocumentId, key: FieldKey): Document {
    const kept = this.#fields.filter(field => {
      const source = field.takenFrom;

      return !(
        source !== null &&
        source.documentId.equals(documentId) &&
        source.fieldKey.equals(key)
      );
    });

    return kept.length === this.#fields.length
      ? this
      : this.with({ fields: kept });
  }

  get fields(): readonly ExtractedField[] {
    return this.#fields;
  }

  get isClassified(): boolean {
    return this.classification !== null;
  }

  /*
   * Whether anything was read off this document.
   *
   * Read off *this* document and not merely held against it: a value carried
   * over from another paper of the package is not this one having been read,
   * and counting it would tell the extraction stage a document it never opened
   * is done with. That is not a nicety — it is what stops a re-run skipping the
   * only document whose fields are all borrowed.
   */
  get hasFields(): boolean {
    return this.#fields.some(field => field.wasReadHere);
  }

  /*
   * Whether a *machine* has read anything off this document.
   *
   * What the extraction stage asks before it skips a paper it takes to be done
   * with, and deliberately not `hasFields`. A document extraction never yielded
   * anything for, whose one value an operator typed in by hand, has not been
   * read by anything — and treating that correction as a reading would make it
   * cancel, silently and for good, the reading of every other field on that
   * paper (COMM-122).
   */
  get hasMachineReadings(): boolean {
    return this.#fields.some(field => field.wasReadByTheMachine);
  }

  // The values an operator typed off this paper. What extraction must not write
  // over, and what a correction replaces when it is made a second time.
  get fieldsEnteredByOperator(): readonly ExtractedField[] {
    return this.#fields.filter(field => field.wasEnteredByOperator);
  }

  // Only what was read off this document. What every rule that asks what a
  // paper states reads, so that a carried-over value can never answer for the
  // paper it was carried to.
  get fieldsReadHere(): readonly ExtractedField[] {
    return this.#fields.filter(field => field.wasReadHere);
  }

  isFrom(sourceFileId: SourceFileId): boolean {
    return this.sourceFileId.equals(sourceFileId);
  }

  classifiedAs(classification: Classification): Document {
    if (this.classification) {
      throw new DocumentAlreadyClassifiedException(
        this.id.value,
        this.classification.type.value,
      );
    }

    return this.with({ classification });
  }

  /*
   * The document with what the extraction stage read off it.
   *
   * What the machine read replaces whatever was held here before — except the
   * values an operator entered, which survive untouched and win over a reading
   * of the same key. A person correcting a value and the machine putting its
   * own back on the next run is the single failure that would make the whole
   * correction feature worthless, so the rule lives here, on the only way a
   * reading can ever reach a document, rather than in the stage that calls it
   * (COMM-122).
   */
  withFields(fields: readonly ExtractedField[]): Document {
    if (!this.classification) {
      throw new DocumentNotClassifiedException(this.id.value);
    }
    if (!this.classification.isPlaced) {
      throw new UnclassifiableDocumentException(this.id.value);
    }

    const corrections = this.fieldsEnteredByOperator;
    const spokenFor = (field: ExtractedField): boolean =>
      corrections.some(correction => correction.key.equals(field.key));

    return this.with({
      fields: [...corrections, ...fields.filter(field => !spokenFor(field))],
    });
  }

  /*
   * The document with values carried over from elsewhere in the package added
   * to what was read off it.
   *
   * Added and never substituted for a reading: the fields already here are what
   * this paper says, and the gathering stage only closes the ones it did not.
   */
  withGathered(fields: readonly ExtractedField[]): Document {
    if (fields.length === 0) return this;

    return this.with({ fields: [...this.#fields, ...fields] });
  }

  // The same document with the archive register's agreement recorded on the
  // fields it agreed with, named by the keys the register was asked about.
  withConfirmed(keys: readonly FieldKey[]): Document {
    if (keys.length === 0) return this;

    return this.with({
      fields: this.#fields.map(field =>
        keys.some(key => key.equals(field.key))
          ? field.confirmedByRegistry()
          : field,
      ),
    });
  }

  /*
   * The same document with what the National Archive Fund said about it.
   *
   * Replaced rather than kept beside the last one, for the reason a registry
   * check is: the package holds one answer per paper, not a history of them.
   * Kept when a file arrives and the rest of the package is re-read, because it
   * is about what this paper says and nothing another paper changes.
   */
  withArchiveQrCheck(check: ArchiveQrCheck): Document {
    if (!this.classification?.isPlaced) {
      throw new DocumentNotClassifiedException(this.id.value);
    }

    return this.with({ archiveQrCheck: check });
  }

  /*
   * The document with an operator's corrections on it.
   *
   * One call for every correction made to one document, because an operator
   * fixes a form and saves it: a document re-stated per keystroke would put the
   * package through the pipeline five times over one edit. A value replaces
   * whatever was there, whatever its origin; a null drops the key, which is the
   * operator stating that the paper does not say it.
   *
   * The sheet of a replaced field is carried onto the correction, so an
   * inspector opening it still turns to the paper the value is printed on. A
   * key nothing was ever read for cites no sheet, because there is none.
   */
  withEdits(
    edits: readonly {
      readonly key: FieldKey;
      readonly value: FieldValue | null;
    }[],
    by: EditorAccountId,
    at: Date,
  ): Document {
    const edited = (key: FieldKey): boolean =>
      edits.some(edit => edit.key.equals(key));

    const kept = this.#fields.filter(field => !edited(field.key));
    const entered = edits.flatMap(edit =>
      edit.value === null
        ? []
        : [
            ExtractedField.enteredByOperator(
              edit.key,
              edit.value,
              this.#fields.find(field => field.key.equals(edit.key))?.foundOn ??
                null,
              by,
              at,
            ),
          ],
    );

    return this.with({ fields: [...kept, ...entered] });
  }

  /*
   * The same document with the archive's answer about it dropped.
   *
   * What a correction to this paper's fields does, and to this paper alone: the
   * question put to the archive is built out of this document's own readings
   * (`archiveQrQuestionOf`), so a value changing here makes the answer one to a
   * question nobody asked any more. Nothing on another paper changes it, which
   * is why no other document's check goes with it (COMM-122).
   */
  withoutArchiveQrCheck(): Document {
    if (this.archiveQrCheck === null) return this;

    return new Document(
      this.id,
      this.sourceFileId,
      this.pages,
      this.classification,
      this.#fields,
      this.superseded,
      null,
      this.spanMarkup,
    );
  }

  /*
   * The same document with the span working drawn onto its sheets.
   *
   * Replaced whole on a re-run rather than added to: half of a picture drawn off
   * one reading beside half drawn off another is a picture of a reading nobody
   * made. The stage that calls this is the only thing that produces one.
   */
  withSpanMarkup(markup: SpanMarkup): Document {
    if (!this.classification?.isPlaced) {
      throw new DocumentNotClassifiedException(this.id.value);
    }

    return this.with({ spanMarkup: markup });
  }

  private with(changes: {
    classification?: Classification;
    fields?: readonly ExtractedField[];
    superseded?: Supersession;
    archiveQrCheck?: ArchiveQrCheck;
    spanMarkup?: SpanMarkup;
  }): Document {
    return new Document(
      this.id,
      this.sourceFileId,
      this.pages,
      changes.classification ?? this.classification,
      changes.fields ?? this.#fields,
      changes.superseded ?? this.superseded,
      changes.archiveQrCheck ?? this.archiveQrCheck,
      changes.spanMarkup ?? this.spanMarkup,
    );
  }
}
