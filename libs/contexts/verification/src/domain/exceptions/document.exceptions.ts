import { DomainException } from "@cadastre/kernel";

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
