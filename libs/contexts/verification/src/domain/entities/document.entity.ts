import {
  DocumentAlreadyClassifiedException,
  DocumentAlreadySplitException,
  DocumentMustHaveAPageException,
  DocumentNotClassifiedException,
  DuplicatePageNumberException,
  PageNotInDocumentException,
  UnclassifiableDocumentException,
} from "../exceptions/index.js";
import {
  type Classification,
  type ContentType,
  DocumentId,
  type Filename,
  type OcrResult,
  type PageId,
  RecognisedText,
  type StorageKey,
} from "../value-objects/index.js";
import type { ExtractedField } from "./extracted-field.entity.js";
import { Page } from "./page.entity.js";

export class Document {
  readonly #pages: readonly Page[];
  readonly #fields: readonly ExtractedField[];

  private constructor(
    public readonly id: DocumentId,
    public readonly filename: Filename,
    public readonly contentType: ContentType,
    public readonly storageKey: StorageKey,
    pages: readonly Page[],
    public readonly classification: Classification | null,
    fields: readonly ExtractedField[],
  ) {
    // Copied, not adopted: `readonly` stops a caller reassigning the array, not
    // pushing into the one it still holds.
    this.#pages = [...pages];
    this.#fields = [...fields];
  }

  static create(
    id: DocumentId,
    filename: Filename,
    contentType: ContentType,
    storageKey: StorageKey,
  ): Document {
    return new Document(id, filename, contentType, storageKey, [], null, []);
  }

  static restore(state: {
    id: DocumentId;
    filename: Filename;
    contentType: ContentType;
    storageKey: StorageKey;
    pages: readonly Page[];
    classification: Classification | null;
    fields: readonly ExtractedField[];
  }): Document {
    return new Document(
      state.id,
      state.filename,
      state.contentType,
      state.storageKey,
      Document.inPageOrder(state.pages),
      state.classification,
      [...state.fields],
    );
  }

  private static inPageOrder(pages: readonly Page[]): readonly Page[] {
    return [...pages].sort(
      (left, right) => left.number.value - right.number.value,
    );
  }

  get pages(): readonly Page[] {
    return this.#pages;
  }

  get fields(): readonly ExtractedField[] {
    return this.#fields;
  }

  get isSplit(): boolean {
    return this.#pages.length > 0;
  }

  get isClassified(): boolean {
    return this.classification !== null;
  }

  get hasFields(): boolean {
    return this.#fields.length > 0;
  }

  get unrecognisedPages(): readonly Page[] {
    return this.#pages.filter((page) => !page.isRecognised);
  }

  get isFullyRecognised(): boolean {
    return this.isSplit && this.unrecognisedPages.length === 0;
  }

  get text(): RecognisedText {
    return this.#pages.reduce(
      (text, page) => (page.ocr ? text.concat(page.ocr.text) : text),
      RecognisedText.empty(),
    );
  }

  pageWith(pageId: PageId): Page {
    const page = this.#pages.find((candidate) => candidate.id.equals(pageId));

    if (!page) {
      throw new PageNotInDocumentException(pageId.value, this.id.value);
    }

    return page;
  }

  splitInto(pages: readonly Page[]): Document {
    if (this.isSplit) throw new DocumentAlreadySplitException(this.id.value);

    if (pages.length === 0) {
      throw new DocumentMustHaveAPageException(this.id.value);
    }

    const seen = new Set<number>();
    for (const page of pages) {
      if (seen.has(page.number.value)) {
        throw new DuplicatePageNumberException(this.id.value, page.number.value);
      }
      seen.add(page.number.value);
    }

    // Sorted on the way in exactly as `restore` sorts on the way back, so `text`
    // survives a round trip through storage.
    return this.with({ pages: Document.inPageOrder(pages) });
  }

  recognised(pageId: PageId, ocr: OcrResult): Document {
    const page = this.pageWith(pageId);

    return this.with({
      pages: this.#pages.map((candidate) =>
        candidate.id.equals(pageId) ? page.recognised(ocr) : candidate,
      ),
    });
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
    pages?: readonly Page[];
    classification?: Classification;
    fields?: readonly ExtractedField[];
  }): Document {
    return new Document(
      this.id,
      this.filename,
      this.contentType,
      this.storageKey,
      changes.pages ?? this.#pages,
      changes.classification ?? this.classification,
      changes.fields ?? this.#fields,
    );
  }
}
