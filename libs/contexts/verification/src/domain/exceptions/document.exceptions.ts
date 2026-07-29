import { DomainException } from "@cadastre/kernel";

export class InvalidFilenameException extends DomainException {
  override readonly code = "INVALID_FILENAME";

  constructor(public readonly reason: "empty" | "too_long") {
    super(`A document filename must not be ${reason.replace("_", " ")}`);
  }
}

export class InvalidStorageKeyException extends DomainException {
  override readonly code = "INVALID_STORAGE_KEY";

  constructor(public readonly reason: "empty" | "too_long") {
    super(`A storage key must not be ${reason.replace("_", " ")}`);
  }
}

export class UnsupportedContentTypeException extends DomainException {
  override readonly code = "UNSUPPORTED_CONTENT_TYPE";

  constructor(public readonly received: string) {
    super(`"${received}" is not a document format this system accepts`);
  }
}

export class InvalidDocumentTypeException extends DomainException {
  override readonly code = "INVALID_DOCUMENT_TYPE";

  constructor(public readonly reason: "empty" | "too_long") {
    super(`A document type key must not be ${reason.replace("_", " ")}`);
  }
}

export class InvalidConfidenceException extends DomainException {
  override readonly code = "INVALID_CONFIDENCE";

  constructor(public readonly received: number) {
    super(`Confidence must be a number between 0 and 1, received ${received}`);
  }
}

export class InvalidPageNumberException extends DomainException {
  override readonly code = "INVALID_PAGE_NUMBER";

  constructor(public readonly received: number) {
    super(`A page number must be a positive integer, received ${received}`);
  }
}

export class InvalidFieldKeyException extends DomainException {
  override readonly code = "INVALID_FIELD_KEY";

  constructor(public readonly reason: "empty" | "too_long") {
    super(`A field key must not be ${reason.replace("_", " ")}`);
  }
}

export class InvalidFieldValueException extends DomainException {
  override readonly code = "INVALID_FIELD_VALUE";

  constructor(public readonly reason: "empty" | "too_long") {
    super(`An extracted field value must not be ${reason.replace("_", " ")}`);
  }
}

export class PageNotInDocumentException extends DomainException {
  override readonly code = "PAGE_NOT_IN_DOCUMENT";

  constructor(
    public readonly pageId: string,
    public readonly documentId: string,
  ) {
    super(`Document ${documentId} has no page ${pageId}`);
  }
}

export class DuplicatePageNumberException extends DomainException {
  override readonly code = "DUPLICATE_PAGE_NUMBER";

  constructor(
    public readonly documentId: string,
    public readonly pageNumber: number,
  ) {
    super(`Document ${documentId} already has a page ${pageNumber}`);
  }
}

export class DocumentMustHaveAPageException extends DomainException {
  override readonly code = "DOCUMENT_MUST_HAVE_A_PAGE";

  constructor(public readonly documentId: string) {
    super(`Document ${documentId} cannot be split into no pages at all`);
  }
}

export class DocumentAlreadySplitException extends DomainException {
  override readonly code = "DOCUMENT_ALREADY_SPLIT";

  constructor(public readonly documentId: string) {
    super(`Document ${documentId} has already been split into pages`);
  }
}

export class PageAlreadyRecognisedException extends DomainException {
  override readonly code = "PAGE_ALREADY_RECOGNISED";

  constructor(public readonly pageId: string) {
    super(`Page ${pageId} has already been recognised`);
  }
}

export class DocumentAlreadyClassifiedException extends DomainException {
  override readonly code = "DOCUMENT_ALREADY_CLASSIFIED";

  constructor(
    public readonly documentId: string,
    public readonly type: string,
  ) {
    super(`Document ${documentId} was already classified as "${type}"`);
  }
}

export class DocumentNotClassifiedException extends DomainException {
  override readonly code = "DOCUMENT_NOT_CLASSIFIED";

  constructor(public readonly documentId: string) {
    super(`Document ${documentId} must be classified before fields are extracted`);
  }
}

export class UnclassifiableDocumentException extends DomainException {
  override readonly code = "UNCLASSIFIABLE_DOCUMENT";

  constructor(public readonly documentId: string) {
    super(`Document ${documentId} has no known type, so it declares no fields`);
  }
}
