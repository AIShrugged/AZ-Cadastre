import {
  DuplicatePageNumberException,
  PageNotInSourceFileException,
  SourceFileAlreadySplitException,
  SourceFileMustHaveAPageException,
} from "../exceptions/index.js";
import {
  type ContentType,
  type Filename,
  type OcrResult,
  type PageId,
  type PageNumber,
  PageRange,
  RecognisedText,
  type SourceFileId,
  type StorageKey,
} from "../value-objects/index.js";
import { Page } from "./page.entity.js";

export class SourceFile {
  readonly #pages: readonly Page[];

  private constructor(
    public readonly id: SourceFileId,
    public readonly filename: Filename,
    public readonly contentType: ContentType,
    public readonly storageKey: StorageKey,
    pages: readonly Page[],
  ) {
    // Copied, not adopted: `readonly` stops a caller reassigning the array, not
    // pushing into the one it still holds.
    this.#pages = [...pages];
  }

  static create(
    id: SourceFileId,
    filename: Filename,
    contentType: ContentType,
    storageKey: StorageKey,
  ): SourceFile {
    return new SourceFile(id, filename, contentType, storageKey, []);
  }

  static restore(state: {
    id: SourceFileId;
    filename: Filename;
    contentType: ContentType;
    storageKey: StorageKey;
    pages: readonly Page[];
  }): SourceFile {
    return new SourceFile(
      state.id,
      state.filename,
      state.contentType,
      state.storageKey,
      SourceFile.inPageOrder(state.pages),
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

  get pageCount(): number {
    return this.#pages.length;
  }

  get isSplit(): boolean {
    return this.#pages.length > 0;
  }

  get unrecognisedPages(): readonly Page[] {
    return this.#pages.filter((page) => !page.isRecognised);
  }

  get isFullyRecognised(): boolean {
    return this.isSplit && this.unrecognisedPages.length === 0;
  }

  get wholeFile(): PageRange | null {
    const first = this.#pages.at(0);
    const last = this.#pages.at(-1);

    return first && last ? PageRange.of(first.number, last.number) : null;
  }

  pageWith(pageId: PageId): Page {
    const page = this.#pages.find((candidate) => candidate.id.equals(pageId));

    if (!page) {
      throw new PageNotInSourceFileException(pageId.value, this.id.value);
    }

    return page;
  }

  pagesIn(range: PageRange): readonly Page[] {
    return this.#pages.filter((page) => range.covers(page.number));
  }

  textIn(range: PageRange): RecognisedText {
    return this.pagesIn(range).reduce(
      (text, page) => (page.ocr ? text.concat(page.ocr.text) : text),
      RecognisedText.empty(),
    );
  }

  splitInto(pages: readonly Page[]): SourceFile {
    if (this.isSplit) throw new SourceFileAlreadySplitException(this.id.value);

    if (pages.length === 0) {
      throw new SourceFileMustHaveAPageException(this.id.value);
    }

    const seen = new Set<number>();
    for (const page of pages) {
      if (seen.has(page.number.value)) {
        throw new DuplicatePageNumberException(this.id.value, page.number.value);
      }
      seen.add(page.number.value);
    }

    // Sorted on the way in exactly as `restore` sorts on the way back, so a page
    // range reads the same before and after a round trip through storage.
    return this.with(SourceFile.inPageOrder(pages));
  }

  recognised(pageId: PageId, ocr: OcrResult): SourceFile {
    const page = this.pageWith(pageId);

    return this.with(
      this.#pages.map((candidate) =>
        candidate.id.equals(pageId) ? page.recognised(ocr) : candidate,
      ),
    );
  }

  transcript(): readonly { number: PageNumber; text: RecognisedText }[] {
    return this.#pages.map((page) => ({
      number: page.number,
      text: page.ocr?.text ?? RecognisedText.empty(),
    }));
  }

  private with(pages: readonly Page[]): SourceFile {
    return new SourceFile(
      this.id,
      this.filename,
      this.contentType,
      this.storageKey,
      pages,
    );
  }
}
