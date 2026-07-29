import { DomainEvent } from "@cadastre/kernel";

import type {
  Classification,
  DocumentId,
  FailureReason,
  PackageId,
  PageId,
  VerificationProfile,
} from "../value-objects/index.js";

export class PackageSubmitted extends DomainEvent {
  override readonly type = "verification.PackageSubmitted";

  constructor(
    public readonly packageId: PackageId,
    public readonly profile: VerificationProfile,
    public readonly documentCount: number,
  ) {
    super();
  }
}

export class VerificationStarted extends DomainEvent {
  override readonly type = "verification.VerificationStarted";

  constructor(public readonly packageId: PackageId) {
    super();
  }
}

export class DocumentSplitIntoPages extends DomainEvent {
  override readonly type = "verification.DocumentSplitIntoPages";

  constructor(
    public readonly packageId: PackageId,
    public readonly documentId: DocumentId,
    public readonly pageCount: number,
  ) {
    super();
  }
}

export class PageRecognised extends DomainEvent {
  override readonly type = "verification.PageRecognised";

  constructor(
    public readonly packageId: PackageId,
    public readonly documentId: DocumentId,
    public readonly pageId: PageId,
  ) {
    super();
  }
}

export class DocumentClassified extends DomainEvent {
  override readonly type = "verification.DocumentClassified";

  constructor(
    public readonly packageId: PackageId,
    public readonly documentId: DocumentId,
    public readonly classification: Classification,
  ) {
    super();
  }
}

export class FieldsExtracted extends DomainEvent {
  override readonly type = "verification.FieldsExtracted";

  constructor(
    public readonly packageId: PackageId,
    public readonly documentId: DocumentId,
    public readonly fieldCount: number,
  ) {
    super();
  }
}

export class VerificationCompleted extends DomainEvent {
  override readonly type = "verification.VerificationCompleted";

  constructor(public readonly packageId: PackageId) {
    super();
  }
}

export class VerificationFailed extends DomainEvent {
  override readonly type = "verification.VerificationFailed";

  constructor(
    public readonly packageId: PackageId,
    public readonly reason: FailureReason,
  ) {
    super();
  }
}
