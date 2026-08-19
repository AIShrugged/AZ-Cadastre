import { DomainException } from "@cadastre/shared";

export class InvalidFilenameException extends DomainException {
  override readonly code = "INVALID_FILENAME";

  constructor(public readonly reason: "empty" | "too_long") {
    super(`A file name must not be ${reason.replace("_", " ")}`);
  }
}

export class InvalidStorageKeyException extends DomainException {
  override readonly code = "INVALID_STORAGE_KEY";

  constructor(public readonly reason: "empty" | "too_long") {
    super(`A storage key must not be ${reason.replace("_", " ")}`);
  }
}

export class InvalidFileSizeException extends DomainException {
  override readonly code = "INVALID_FILE_SIZE";

  constructor(public readonly received: number) {
    super(
      `A file size must be a positive whole number of bytes, received ${received}`,
    );
  }
}

export class FileTooLargeException extends DomainException {
  override readonly code = "FILE_TOO_LARGE";

  constructor(
    public readonly received: number,
    public readonly max: number,
  ) {
    super(
      `A file may be at most ${Math.round(max / (1024 * 1024))} MB, received ` +
        `${(received / (1024 * 1024)).toFixed(1)} MB`,
    );
  }
}

export class UnsupportedContentTypeException extends DomainException {
  override readonly code = "UNSUPPORTED_CONTENT_TYPE";

  constructor(public readonly received: string) {
    super(`"${received}" is not a file format this system accepts`);
  }
}

export class InvalidPageNumberException extends DomainException {
  override readonly code = "INVALID_PAGE_NUMBER";

  constructor(public readonly received: number) {
    super(`A page number must be a positive integer, received ${received}`);
  }
}

export class InvalidPageRangeException extends DomainException {
  override readonly code = "INVALID_PAGE_RANGE";

  constructor(
    public readonly first: number,
    public readonly last: number,
  ) {
    super(`A page range cannot end before it starts: ${first}–${last}`);
  }
}

export class PageNotInSourceFileException extends DomainException {
  override readonly code = "PAGE_NOT_IN_SOURCE_FILE";

  constructor(
    public readonly pageId: string,
    public readonly sourceFileId: string,
  ) {
    super(`Source file ${sourceFileId} has no page ${pageId}`);
  }
}

export class DuplicatePageNumberException extends DomainException {
  override readonly code = "DUPLICATE_PAGE_NUMBER";

  constructor(
    public readonly sourceFileId: string,
    public readonly pageNumber: number,
  ) {
    super(`Source file ${sourceFileId} already has a page ${pageNumber}`);
  }
}

export class SourceFileMustHaveAPageException extends DomainException {
  override readonly code = "SOURCE_FILE_MUST_HAVE_A_PAGE";

  constructor(public readonly sourceFileId: string) {
    super(`Source file ${sourceFileId} cannot be split into no pages at all`);
  }
}

export class SourceFileAlreadySplitException extends DomainException {
  override readonly code = "SOURCE_FILE_ALREADY_SPLIT";

  constructor(public readonly sourceFileId: string) {
    super(`Source file ${sourceFileId} has already been split into pages`);
  }
}

export class SourceFileNotSplitException extends DomainException {
  override readonly code = "SOURCE_FILE_NOT_SPLIT";

  constructor(public readonly sourceFileId: string) {
    super(
      `Source file ${sourceFileId} has no pages yet, so it holds no documents`,
    );
  }
}

export class PageAlreadyRecognisedException extends DomainException {
  override readonly code = "PAGE_ALREADY_RECOGNISED";

  constructor(public readonly pageId: string) {
    super(`Page ${pageId} has already been recognised`);
  }
}

export class SourceFileAlreadySegmentedException extends DomainException {
  override readonly code = "SOURCE_FILE_ALREADY_SEGMENTED";

  constructor(public readonly sourceFileId: string) {
    super(
      `Source file ${sourceFileId} has already been read into its documents`,
    );
  }
}

export class SourceFileMustHaveADocumentException extends DomainException {
  override readonly code = "SOURCE_FILE_MUST_HAVE_A_DOCUMENT";

  constructor(public readonly sourceFileId: string) {
    super(`Source file ${sourceFileId} must hold at least one document`);
  }
}

export class DocumentsMustCoverEverySheetException extends DomainException {
  override readonly code = "DOCUMENTS_MUST_COVER_EVERY_SHEET";

  constructor(
    public readonly sourceFileId: string,
    public readonly pageCount: number,
  ) {
    super(
      `The documents found in source file ${sourceFileId} must together cover ` +
        `its ${pageCount} page(s) once each, back to back`,
    );
  }
}
