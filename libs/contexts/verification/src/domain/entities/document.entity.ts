import {
  DocumentAlreadyClassifiedException,
  DocumentNotClassifiedException,
  UnclassifiableDocumentException,
} from "../exceptions/index.js";
import type {
  Classification,
  DocumentId,
  PageRange,
  SourceFileId,
} from "../value-objects/index.js";
import type { ExtractedField } from "./extracted-field.entity.js";

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

  get hasFields(): boolean {
    return this.#fields.length > 0;
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
