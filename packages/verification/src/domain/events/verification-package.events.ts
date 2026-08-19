import { DomainEvent } from '@cadastre/shared';

import type {
  Classification,
  CrossCheckKey,
  CrossCheckVerdict,
  DocumentId,
  FailureReason,
  PackageId,
  PageId,
  ReportStatus,
  SourceFileId,
  VerificationProfile,
} from '../value-objects/index.js';

export class PackageSubmitted extends DomainEvent {
  override readonly type = 'verification.PackageSubmitted';

  constructor(
    public readonly packageId: PackageId,
    public readonly profile: VerificationProfile,
    public readonly fileCount: number,
  ) {
    super();
  }
}

export class VerificationStarted extends DomainEvent {
  override readonly type = 'verification.VerificationStarted';

  constructor(public readonly packageId: PackageId) {
    super();
  }
}

export class SourceFileSplitIntoPages extends DomainEvent {
  override readonly type = 'verification.SourceFileSplitIntoPages';

  constructor(
    public readonly packageId: PackageId,
    public readonly sourceFileId: SourceFileId,
    public readonly pageCount: number,
  ) {
    super();
  }
}

export class PageRecognised extends DomainEvent {
  override readonly type = 'verification.PageRecognised';

  constructor(
    public readonly packageId: PackageId,
    public readonly sourceFileId: SourceFileId,
    public readonly pageId: PageId,
  ) {
    super();
  }
}

export class SourceFileSegmented extends DomainEvent {
  override readonly type = 'verification.SourceFileSegmented';

  constructor(
    public readonly packageId: PackageId,
    public readonly sourceFileId: SourceFileId,
    public readonly documentCount: number,
  ) {
    super();
  }
}

export class DocumentClassified extends DomainEvent {
  override readonly type = 'verification.DocumentClassified';

  constructor(
    public readonly packageId: PackageId,
    public readonly documentId: DocumentId,
    public readonly classification: Classification,
  ) {
    super();
  }
}

export class FieldsExtracted extends DomainEvent {
  override readonly type = 'verification.FieldsExtracted';

  constructor(
    public readonly packageId: PackageId,
    public readonly documentId: DocumentId,
    public readonly fieldCount: number,
  ) {
    super();
  }
}

export class CrossCheckMade extends DomainEvent {
  override readonly type = 'verification.CrossCheckMade';

  constructor(
    public readonly packageId: PackageId,
    public readonly key: CrossCheckKey,
    public readonly verdict: CrossCheckVerdict,
  ) {
    super();
  }
}

export class ReportCompiled extends DomainEvent {
  override readonly type = 'verification.ReportCompiled';

  constructor(
    public readonly packageId: PackageId,
    public readonly status: ReportStatus,
    public readonly issueCount: number,
  ) {
    super();
  }
}

export class VerificationCompleted extends DomainEvent {
  override readonly type = 'verification.VerificationCompleted';

  constructor(public readonly packageId: PackageId) {
    super();
  }
}

export class VerificationFailed extends DomainEvent {
  override readonly type = 'verification.VerificationFailed';

  constructor(
    public readonly packageId: PackageId,
    public readonly reason: FailureReason,
  ) {
    super();
  }
}
