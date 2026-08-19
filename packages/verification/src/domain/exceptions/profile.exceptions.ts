import { DomainException } from "@cadastre/shared";

export class UnknownProfileException extends DomainException {
  override readonly code = "UNKNOWN_PROFILE";

  constructor(public readonly profileKey: string) {
    super(`No verification profile "${profileKey}"`);
  }
}

export class DocumentTypeNotInProfileException extends DomainException {
  override readonly code = "DOCUMENT_TYPE_NOT_IN_PROFILE";

  constructor(
    public readonly type: string,
    public readonly profileKey: string,
  ) {
    super(`Profile "${profileKey}" does not recognise document type "${type}"`);
  }
}

export class FieldNotInSchemaException extends DomainException {
  override readonly code = "FIELD_NOT_IN_SCHEMA";

  constructor(
    public readonly fieldKey: string,
    public readonly type: string,
  ) {
    super(`Document type "${type}" declares no field "${fieldKey}"`);
  }
}
