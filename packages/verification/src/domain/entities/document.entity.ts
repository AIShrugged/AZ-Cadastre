import {
  DocumentAlreadyClassifiedException,
  DocumentNotClassifiedException,
  UnclassifiableDocumentException,
} from '../exceptions/index.js';
import { Supersession } from '../value-objects/index.js';
import type {
  Classification,
  DocumentId,
  FieldKey,
  PageRange,
  SourceFileId,
} from '../value-objects/index.js';

import type { ExtractedField } from './extracted-field.entity.js';

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
  ) {
    this.#fields = [...fields];
  }

  static create(
    id: DocumentId,
    sourceFileId: SourceFileId,
    pages: PageRange,
  ): Document {
    return new Document(id, sourceFileId, pages, null, [], null);
  }

  static restore(state: {
    id: DocumentId;
    sourceFileId: SourceFileId;
    pages: PageRange;
    classification: Classification | null;
    fields: readonly ExtractedField[];
    superseded?: Supersession | null;
  }): Document {
    return new Document(
      state.id,
      state.sourceFileId,
      state.pages,
      state.classification,
      state.fields,
      state.superseded ?? null,
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

  withFields(fields: readonly ExtractedField[]): Document {
    if (!this.classification) {
      throw new DocumentNotClassifiedException(this.id.value);
    }
    if (!this.classification.isPlaced) {
      throw new UnclassifiableDocumentException(this.id.value);
    }

    return this.with({ fields });
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

  private with(changes: {
    classification?: Classification;
    fields?: readonly ExtractedField[];
    superseded?: Supersession;
  }): Document {
    return new Document(
      this.id,
      this.sourceFileId,
      this.pages,
      changes.classification ?? this.classification,
      changes.fields ?? this.#fields,
      changes.superseded ?? this.superseded,
    );
  }
}
