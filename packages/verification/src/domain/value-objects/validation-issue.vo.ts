import type { Confidence } from './confidence.vo.js';
import { CrossCheckVerdict } from './cross-check-verdict.vo.js';
import type { CrossCheck, CrossCheckKey } from './cross-check.vo.js';
import { DocumentType as DocumentTypeRef } from './document-type.vo.js';
import type { DocumentType } from './document-type.vo.js';
import type { DocumentId, SourceFileId } from './entity-ids/index.js';
import type { FieldKey } from './field.vo.js';
import { IssueKind } from './issue-kind.vo.js';
import type { PageNumber } from './page-number.vo.js';
import type { PageRange } from './page-range.vo.js';

type Finding = {
  readonly kind: IssueKind;
  readonly message: string;
  readonly documentId?: DocumentId | null;
  readonly sourceFileId?: SourceFileId | null;
  readonly documentType?: DocumentType | null;
  readonly fieldKey?: FieldKey | null;
  readonly checkKey?: CrossCheckKey | null;
  readonly pageNumber?: PageNumber | null;
  readonly confidence?: Confidence | null;
};

// One finding in a report. It carries what it is about — a type, a document, a
// field, a sheet — so a reader can render it in their own language; `message`
// is the audit line, written once, in English, and never translated.
export class ValidationIssue {
  private constructor(
    public readonly kind: IssueKind,
    public readonly message: string,
    public readonly documentId: DocumentId | null,
    public readonly sourceFileId: SourceFileId | null,
    public readonly documentType: DocumentType | null,
    public readonly fieldKey: FieldKey | null,
    public readonly checkKey: CrossCheckKey | null,
    public readonly pageNumber: PageNumber | null,
    public readonly confidence: Confidence | null,
  ) {}

  static of(finding: Finding): ValidationIssue {
    return new ValidationIssue(
      finding.kind,
      finding.message,
      finding.documentId ?? null,
      finding.sourceFileId ?? null,
      finding.documentType ?? null,
      finding.fieldKey ?? null,
      finding.checkKey ?? null,
      finding.pageNumber ?? null,
      finding.confidence ?? null,
    );
  }

  static missingDocument(type: DocumentType): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.MISSING_DOCUMENT,
      message: `The package carries no "${type.value}", which this profile requires.`,
      documentType: type,
    });
  }

  static unplacedDocument(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    pages: PageRange,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.UNREADABLE_DOCUMENT,
      message:
        `The document on sheets ${pages.first.value}–${pages.last.value} ` +
        `could not be recognised as any type this profile expects.`,
      documentId,
      sourceFileId,
      pageNumber: pages.first,
    });
  }

  static extraDocument(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    pages: PageRange,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.EXTRA_DOCUMENT,
      message:
        `The document on sheets ${pages.first.value}–${pages.last.value} ` +
        `was read but is not a type this profile asks for.`,
      documentId,
      sourceFileId,
      documentType: DocumentTypeRef.OUT_OF_PROFILE,
      pageNumber: pages.first,
    });
  }

  static duplicateDocument(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    type: DocumentType,
    pages: PageRange,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.DUPLICATE_DOCUMENT,
      message:
        `The document on sheets ${pages.first.value}–${pages.last.value} is a ` +
        `second "${type.value}" in this package; the requirement was already answered.`,
      documentId,
      sourceFileId,
      documentType: type,
      pageNumber: pages.first,
    });
  }

  static unreadableSheet(
    sourceFileId: SourceFileId,
    pageNumber: PageNumber,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.UNREADABLE_DOCUMENT,
      message: `Sheet ${pageNumber.value} of the file could not be read.`,
      sourceFileId,
      pageNumber,
    });
  }

  static unreadableFile(sourceFileId: SourceFileId): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.UNREADABLE_DOCUMENT,
      message: 'The file could not be read into the documents it holds.',
      sourceFileId,
    });
  }

  // Filed against the first value the check weighed — the document the profile
  // named first — so the inspector lands on one side of the disagreement and
  // the message names the other.
  static crossCheckFailed(check: CrossCheck): ValidationIssue {
    const anchor = check.anchor;
    const said = check.verdict.equals(CrossCheckVerdict.MISMATCH)
      ? `The documents do not agree on "${check.key.value}"`
      : `Whether the documents agree on "${check.key.value}" could not be decided`;

    return ValidationIssue.of({
      kind: IssueKind.FIELD_MISMATCH,
      message: `${said}: ${check.cited}.${check.note ? ` ${check.note}` : ''}`,
      documentId: anchor?.documentId,
      documentType: anchor?.documentType,
      fieldKey: anchor?.fieldKey,
      checkKey: check.key,
      pageNumber: anchor?.foundOn,
      confidence: check.confidence,
    });
  }

  static lowConfidenceType(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    type: DocumentType,
    confidence: Confidence,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.LOW_CONFIDENCE,
      message:
        `The document was placed as "${type.value}" with a confidence of ` +
        `${confidence.value.toFixed(2)}.`,
      documentId,
      sourceFileId,
      documentType: type,
      confidence,
    });
  }

  static lowConfidenceField(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    type: DocumentType | null,
    fieldKey: FieldKey,
    pageNumber: PageNumber,
    confidence: Confidence,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.LOW_CONFIDENCE,
      message:
        `"${fieldKey.value}" was read with a confidence of ` +
        `${confidence.value.toFixed(2)}.`,
      documentId,
      sourceFileId,
      documentType: type,
      fieldKey,
      pageNumber,
      confidence,
    });
  }
}
