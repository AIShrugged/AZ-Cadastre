import {
  DocumentAlreadyClassifiedException,
  DocumentNotClassifiedException,
  UnclassifiableDocumentException,
} from '../exceptions/index.js';
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
  ) {
    this.#fields = [...fields];
  }

  static create(
    id: DocumentId,
    sourceFileId: SourceFileId,
    pages: PageRange,
  ): Document {
    return new Document(id, sourceFileId, pages, null, []);
  }

  static restore(state: {
    id: DocumentId;
    sourceFileId: SourceFileId;
    pages: PageRange;
    classification: Classification | null;
    fields: readonly ExtractedField[];
  }): Document {
    return new Document(
      state.id,
      state.sourceFileId,
      state.pages,
      state.classification,
      state.fields,
    );
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
  }): Document {
    return new Document(
      this.id,
      this.sourceFileId,
      this.pages,
      changes.classification ?? this.classification,
      changes.fields ?? this.#fields,
    );
  }
}
