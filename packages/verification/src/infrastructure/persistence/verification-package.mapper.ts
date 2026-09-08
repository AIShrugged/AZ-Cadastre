import { VerificationPackage } from '../../domain/aggregates/index.js';
import {
  Document,
  ExtractedField,
  Page,
  SourceFile,
} from '../../domain/entities/index.js';
import {
  CheckedValue,
  Classification,
  Confidence,
  ContentType,
  CrossCheck,
  CrossCheckKey,
  CrossCheckVerdict,
  DocumentId,
  DocumentType,
  FieldKey,
  FieldValue,
  Filename,
  IssueKind,
  OcrResult,
  PackageId,
  PackageStatus,
  PageId,
  PageImage,
  PageNumber,
  PageRange,
  RecognisedText,
  RegistryAttribute,
  RegistryCheck,
  RegistryCheckKey,
  RegistryDocument,
  RegistryOutcome,
  ReportStatus,
  SourceFileId,
  StorageKey,
  ValidationIssue,
  VerificationProfile,
  VerificationReport,
} from '../../domain/value-objects/index.js';

import {
  ArchiveHolding as ArchiveHoldingColumn,
  CrossCheckVerdict as CrossCheckVerdictColumn,
  IssueKind as IssueKindColumn,
  RegistryOutcome as RegistryOutcomeColumn,
  ReportStatus as ReportStatusColumn,
  PackageStatus as StatusColumn,
} from './generated/client.js';

export type PackageRow = {
  readonly id: string;
  readonly status: string;
  readonly profileKey: string;
  readonly version: number;
  readonly sourceFiles: readonly SourceFileRow[];
  readonly documents: readonly DocumentRow[];
  readonly crossChecks: readonly CrossCheckRow[];
  readonly registryChecks: readonly RegistryCheckRow[];
  readonly report: ReportRow | null;
};

export type ReportRow = {
  readonly status: string;
  readonly issues: readonly IssueRow[];
};

export type IssueRow = {
  readonly kind: string;
  readonly message: string;
  readonly documentId: string | null;
  readonly sourceFileId: string | null;
  readonly documentType: string | null;
  readonly fieldName: string | null;
  readonly checkKey: string | null;
  readonly pageNumber: number | null;
  readonly confidence: number | null;
};

export type CrossCheckRow = {
  readonly key: string;
  readonly verdict: string;
  readonly confidence: number;
  readonly note: string;
  readonly values: readonly CheckedValueRow[];
};

export type RegistryCheckRow = {
  readonly key: string;
  readonly outcome: string;
  readonly confidence: number;
  readonly note: string;
  readonly reference: string | null;
  readonly documentId: string | null;
  readonly documentType: string;
  readonly fieldName: string;
  readonly value: string;
  readonly pageNumber: number;
  readonly valueConfidence: number;
  readonly attributes: readonly RegistryAttributeRow[];
  readonly documents: readonly RegistryDocumentRow[];
};

export type RegistryDocumentRow = {
  readonly name: string;
  readonly holding: string;
  readonly recordedNumber: string | null;
  readonly recordedDate: string | null;
  readonly reference: string | null;
  readonly documentId: string | null;
  readonly documentType: string;
  readonly pageNumber: number;
};

export type RegistryAttributeRow = {
  readonly name: string;
  readonly agrees: boolean;
  readonly recorded: string | null;
  readonly documentId: string | null;
  readonly documentType: string;
  readonly fieldName: string;
  readonly value: string;
  readonly pageNumber: number;
  readonly confidence: number;
};

export type CheckedValueRow = {
  readonly documentId: string | null;
  readonly documentType: string;
  readonly fieldName: string;
  readonly value: string;
  readonly pageNumber: number;
  readonly confidence: number;
};

export type SourceFileRow = {
  readonly id: string;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly storageKey: string;
  readonly pages: readonly PageRow[];
};

export type DocumentRow = {
  readonly id: string;
  readonly sourceFileId: string;
  readonly firstPage: number;
  readonly lastPage: number;
  readonly type: string | null;
  readonly classificationConfidence: number | null;
  readonly knownAs: string | null;
  readonly extractedFields: readonly FieldRow[];
};

export type PageRow = {
  readonly id: string;
  readonly pageNumber: number;
  readonly imageStorageKey: string;
  readonly imageContentType: string;
  readonly ocr: OcrRow | null;
};

export type OcrRow = {
  readonly text: string;
  readonly confidence: number;
};

export type FieldRow = {
  readonly name: string;
  readonly value: string;
  readonly confidence: number;
  readonly pageNumber: number;
};

export type PackageWrite = {
  readonly id: string;
  readonly status: StatusColumn;
  readonly profileKey: string;
  readonly sourceFiles: readonly SourceFileWrite[];
  readonly documents: readonly DocumentWrite[];
  readonly crossChecks: readonly CrossCheckWrite[];
  readonly registryChecks: readonly RegistryCheckWrite[];
  readonly report: ReportWrite | null;
};

export type ReportWrite = {
  readonly status: ReportStatusColumn;
  readonly issues: readonly IssueWrite[];
};

export type IssueWrite = {
  readonly kind: IssueKindColumn;
  readonly message: string;
  readonly documentId: string | null;
  readonly sourceFileId: string | null;
  readonly documentType: string | null;
  readonly fieldName: string | null;
  readonly checkKey: string | null;
  readonly pageNumber: number | null;
  readonly confidence: number | null;
};

export type CrossCheckWrite = {
  readonly key: string;
  readonly verdict: CrossCheckVerdictColumn;
  readonly confidence: number;
  readonly note: string;
  readonly values: readonly CheckedValueWrite[];
};

export type RegistryCheckWrite = {
  readonly key: string;
  readonly outcome: RegistryOutcomeColumn;
  readonly confidence: number;
  readonly note: string;
  readonly reference: string | null;
  readonly documentId: string;
  readonly documentType: string;
  readonly fieldName: string;
  readonly value: string;
  readonly pageNumber: number;
  readonly valueConfidence: number;
  readonly attributes: readonly RegistryAttributeWrite[];
  readonly documents: readonly RegistryDocumentWrite[];
};

export type RegistryDocumentWrite = {
  readonly name: string;
  readonly holding: ArchiveHoldingColumn;
  readonly recordedNumber: string | null;
  readonly recordedDate: string | null;
  readonly reference: string | null;
  readonly documentId: string;
  readonly documentType: string;
  readonly pageNumber: number;
  readonly position: number;
};

export type RegistryAttributeWrite = {
  readonly name: string;
  readonly agrees: boolean;
  readonly recorded: string | null;
  readonly documentId: string;
  readonly documentType: string;
  readonly fieldName: string;
  readonly value: string;
  readonly pageNumber: number;
  readonly confidence: number;
  readonly position: number;
};

export type CheckedValueWrite = {
  readonly documentId: string;
  readonly documentType: string;
  readonly fieldName: string;
  readonly value: string;
  readonly pageNumber: number;
  readonly confidence: number;
  readonly position: number;
};

export type SourceFileWrite = {
  readonly id: string;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly storageKey: string;
  readonly pages: readonly PageWrite[];
};

export type DocumentWrite = {
  readonly id: string;
  readonly sourceFileId: string;
  readonly firstPage: number;
  readonly lastPage: number;
  readonly type: string | null;
  readonly classificationConfidence: number | null;
  readonly knownAs: string | null;
  readonly fields: readonly FieldWrite[];
};

export type PageWrite = {
  readonly id: string;
  readonly pageNumber: number;
  readonly imageStorageKey: string;
  readonly imageContentType: string;
  readonly ocr: OcrWrite | null;
};

export type OcrWrite = {
  readonly text: string;
  readonly confidence: number;
};

export type FieldWrite = {
  readonly name: string;
  readonly value: string;
  readonly confidence: number;
  readonly pageNumber: number;
};

export class VerificationPackageMapper {
  static toDomain(row: PackageRow): VerificationPackage {
    return VerificationPackage.restore({
      id: PackageId.of(row.id),
      version: row.version,
      profile: VerificationProfile.of(row.profileKey),
      status: PackageStatus.of(row.status),
      files: row.sourceFiles.map(file =>
        VerificationPackageMapper.fileToDomain(file),
      ),
      documents: row.documents.map(document =>
        VerificationPackageMapper.documentToDomain(document),
      ),
      crossChecks: row.crossChecks.map(check =>
        VerificationPackageMapper.crossCheckToDomain(check),
      ),
      registryChecks: row.registryChecks.flatMap(check =>
        VerificationPackageMapper.registryCheckToDomain(check),
      ),
      report: row.report
        ? VerificationPackageMapper.reportToDomain(row.report)
        : null,
    });
  }

  static toRow(aggregate: VerificationPackage): PackageWrite {
    return {
      id: aggregate.id.value,
      status: VerificationPackageMapper.statusColumn(aggregate.status),
      profileKey: aggregate.profile.key,
      sourceFiles: aggregate.files.map(file => ({
        id: file.id.value,
        originalFilename: file.filename.value,
        contentType: file.contentType.value,
        storageKey: file.storageKey.value,
        pages: file.pages.map(page => ({
          id: page.id.value,
          pageNumber: page.number.value,
          imageStorageKey: page.image.storageKey.value,
          imageContentType: page.image.contentType.value,
          ocr: page.ocr
            ? {
                text: page.ocr.text.value,
                confidence: page.ocr.confidence.value,
              }
            : null,
        })),
      })),
      documents: aggregate.documents.map(document => ({
        id: document.id.value,
        sourceFileId: document.sourceFileId.value,
        firstPage: document.pages.first.value,
        lastPage: document.pages.last.value,
        type: document.classification?.type.value ?? null,
        classificationConfidence:
          document.classification?.confidence.value ?? null,
        knownAs: document.classification?.knownAs?.value ?? null,
        fields: document.fields.map(field => ({
          name: field.key.value,
          value: field.value.value,
          confidence: field.confidence.value,
          pageNumber: field.foundOn.value,
        })),
      })),
      crossChecks: aggregate.crossChecks.map(check => ({
        key: check.key.value,
        verdict: VerificationPackageMapper.verdictColumn(check.verdict),
        confidence: check.confidence.value,
        note: check.note,
        values: check.values.map((value, position) => ({
          documentId: value.documentId.value,
          documentType: value.documentType.value,
          fieldName: value.fieldKey.value,
          value: value.value.value,
          pageNumber: value.foundOn.value,
          confidence: value.confidence.value,
          position,
        })),
      })),
      registryChecks: aggregate.registryChecks.flatMap(check => {
        const asked = check.asked;

        return [
          {
            key: check.key.value,
            outcome: VerificationPackageMapper.outcomeColumn(check.outcome),
            confidence: check.confidence.value,
            note: check.note,
            reference: check.reference,
            documentId: asked.documentId.value,
            documentType: asked.documentType.value,
            fieldName: asked.fieldKey.value,
            value: asked.value.value,
            pageNumber: asked.foundOn.value,
            valueConfidence: asked.confidence.value,
            attributes: check.attributes.map((attribute, position) => ({
              name: attribute.name,
              agrees: attribute.agrees,
              recorded: attribute.recorded,
              documentId: attribute.submitted.documentId.value,
              documentType: attribute.submitted.documentType.value,
              fieldName: attribute.submitted.fieldKey.value,
              value: attribute.submitted.value.value,
              pageNumber: attribute.submitted.foundOn.value,
              confidence: attribute.submitted.confidence.value,
              position,
            })),
            documents: check.documents.map((document, position) => ({
              name: document.name,
              holding: VerificationPackageMapper.holdingColumn(
                document.holding,
              ),
              recordedNumber: document.recordedNumber,
              recordedDate: document.recordedDate,
              reference: document.reference,
              documentId: document.carried.documentId.value,
              documentType: document.carried.documentType.value,
              pageNumber: document.carried.foundOn.value,
              position,
            })),
          },
        ];
      }),
      report: VerificationPackageMapper.reportRow(aggregate.report),
    };
  }

  // A check whose document a later run removed is dropped rather than guessed
  // at: what it says is filed against a sheet, and without the sheet there is
  // nothing for the inspector to open.
  private static registryCheckToDomain(
    row: RegistryCheckRow,
  ): readonly RegistryCheck[] {
    if (row.documentId === null) return [];

    const asked = CheckedValue.of({
      documentId: DocumentId.of(row.documentId),
      documentType: DocumentType.create(row.documentType),
      fieldKey: FieldKey.create(row.fieldName),
      value: FieldValue.create(row.value),
      foundOn: PageNumber.of(row.pageNumber),
      confidence: Confidence.of(row.valueConfidence),
    });

    return [
      RegistryCheck.restore({
        key: RegistryCheckKey.create(row.key),
        outcome: RegistryOutcome.of(row.outcome),
        confidence: Confidence.of(row.confidence),
        note: row.note,
        asked,
        reference: row.reference,
        attributes: row.attributes.flatMap(attribute =>
          attribute.documentId === null
            ? []
            : [
                RegistryAttribute.of({
                  name: attribute.name,
                  agrees: attribute.agrees,
                  recorded: attribute.recorded,
                  submitted: CheckedValue.of({
                    documentId: DocumentId.of(attribute.documentId),
                    documentType: DocumentType.create(attribute.documentType),
                    fieldKey: FieldKey.create(attribute.fieldName),
                    value: FieldValue.create(attribute.value),
                    foundOn: PageNumber.of(attribute.pageNumber),
                    confidence: Confidence.of(attribute.confidence),
                  }),
                }),
              ],
        ),
        // Dropped rather than guessed at, for the same reason an attribute is:
        // what it says is filed against a sheet, and without the sheet there is
        // nothing for the inspector to open.
        documents: row.documents.flatMap(document =>
          document.documentId === null
            ? []
            : [
                RegistryDocument.of({
                  name: document.name,
                  holding: document.holding as RegistryDocument['holding'],
                  recordedNumber: document.recordedNumber,
                  recordedDate: document.recordedDate,
                  reference: document.reference,
                  carried: CheckedValue.of({
                    documentId: DocumentId.of(document.documentId),
                    documentType: DocumentType.create(document.documentType),
                    // The paper is what was asked about, so the anchor is the
                    // document and not a field of it. The key is kept for the
                    // shape a CheckedValue has to have.
                    fieldKey: FieldKey.create('document'),
                    value: FieldValue.create(document.name),
                    foundOn: PageNumber.of(document.pageNumber),
                    confidence: Confidence.of(1),
                  }),
                }),
              ],
        ),
      }),
    ];
  }

  private static holdingColumn(
    holding: RegistryDocument['holding'],
  ): ArchiveHoldingColumn {
    const column = Object.values(ArchiveHoldingColumn).find(
      candidate => candidate === holding,
    );

    if (!column) {
      throw new RangeError(`No archive holding column for ${holding}`);
    }

    return column;
  }

  private static crossCheckToDomain(row: CrossCheckRow): CrossCheck {
    return CrossCheck.restore({
      key: CrossCheckKey.create(row.key),
      verdict: CrossCheckVerdict.of(row.verdict),
      confidence: Confidence.of(row.confidence),
      note: row.note,
      // A value whose document a later run removed is dropped rather than
      // guessed at: the check keeps the sides it can still point the inspector
      // to.
      values: row.values.flatMap(value =>
        value.documentId === null
          ? []
          : [
              CheckedValue.of({
                documentId: DocumentId.of(value.documentId),
                documentType: DocumentType.create(value.documentType),
                fieldKey: FieldKey.create(value.fieldName),
                value: FieldValue.create(value.value),
                foundOn: PageNumber.of(value.pageNumber),
                confidence: Confidence.of(value.confidence),
              }),
            ],
      ),
    });
  }

  private static reportRow(
    report: VerificationReport | null,
  ): ReportWrite | null {
    if (!report) return null;

    return {
      status: VerificationPackageMapper.reportStatusColumn(report.status),
      issues: report.issues.map(issue => ({
        kind: VerificationPackageMapper.issueKindColumn(issue.kind),
        message: issue.message,
        documentId: issue.documentId?.value ?? null,
        sourceFileId: issue.sourceFileId?.value ?? null,
        documentType: issue.documentType?.value ?? null,
        fieldName: issue.fieldKey?.value ?? null,
        checkKey: issue.checkKey?.value ?? null,
        pageNumber: issue.pageNumber?.value ?? null,
        confidence: issue.confidence?.value ?? null,
      })),
    };
  }

  private static reportToDomain(row: ReportRow): VerificationReport {
    return VerificationReport.restore(
      ReportStatus.of(row.status),
      row.issues.map(issue =>
        ValidationIssue.of({
          kind: IssueKind.of(issue.kind),
          message: issue.message,
          documentId: issue.documentId ? DocumentId.of(issue.documentId) : null,
          sourceFileId: issue.sourceFileId
            ? SourceFileId.of(issue.sourceFileId)
            : null,
          documentType: issue.documentType
            ? DocumentType.create(issue.documentType)
            : null,
          fieldKey: issue.fieldName ? FieldKey.create(issue.fieldName) : null,
          checkKey: issue.checkKey
            ? CrossCheckKey.create(issue.checkKey)
            : null,
          pageNumber:
            issue.pageNumber === null ? null : PageNumber.of(issue.pageNumber),
          confidence:
            issue.confidence === null ? null : Confidence.of(issue.confidence),
        }),
      ),
    );
  }

  private static fileToDomain(row: SourceFileRow): SourceFile {
    return SourceFile.restore({
      id: SourceFileId.of(row.id),
      filename: Filename.create(row.originalFilename),
      contentType: ContentType.of(row.contentType),
      storageKey: StorageKey.create(row.storageKey),
      pages: row.pages.map(page =>
        VerificationPackageMapper.pageToDomain(page),
      ),
    });
  }

  private static documentToDomain(row: DocumentRow): Document {
    return Document.restore({
      id: DocumentId.of(row.id),
      sourceFileId: SourceFileId.of(row.sourceFileId),
      pages: PageRange.of(
        PageNumber.of(row.firstPage),
        PageNumber.of(row.lastPage),
      ),
      classification: VerificationPackageMapper.classificationToDomain(row),
      fields: row.extractedFields.map(field =>
        ExtractedField.of(
          FieldKey.create(field.name),
          FieldValue.create(field.value),
          Confidence.of(field.confidence),
          PageNumber.of(field.pageNumber),
        ),
      ),
    });
  }

  // The type column is what says the classifier has run: a row written before
  // the confidence column existed still carries one.
  private static classificationToDomain(
    row: DocumentRow,
  ): Classification | null {
    if (row.type === null) return null;

    const confidence =
      row.classificationConfidence === null
        ? Confidence.none()
        : Confidence.of(row.classificationConfidence);

    const type = DocumentType.create(row.type);

    // Only an out-of-profile reading carries a catalogue name, and a row
    // written before the column existed carries none — which is the same thing
    // as a document the catalogue had no name for (ADR-0012).
    if (type.isOutOfProfile) {
      return Classification.outOfProfile(
        confidence,
        row.knownAs === null ? null : DocumentType.create(row.knownAs),
      );
    }

    return Classification.of(type, confidence);
  }

  private static pageToDomain(row: PageRow): Page {
    return Page.restore(
      PageId.of(row.id),
      PageNumber.of(row.pageNumber),
      PageImage.of(
        StorageKey.create(row.imageStorageKey),
        ContentType.of(row.imageContentType),
      ),
      row.ocr
        ? OcrResult.of(
            RecognisedText.of(row.ocr.text),
            Confidence.of(row.ocr.confidence),
          )
        : null,
    );
  }

  private static statusColumn(status: PackageStatus): StatusColumn {
    const column = Object.values(StatusColumn).find(
      candidate => candidate === status.value,
    );

    if (!column) {
      throw new RangeError(`No status column for ${status.value}`);
    }

    return column;
  }

  private static reportStatusColumn(status: ReportStatus): ReportStatusColumn {
    const column = Object.values(ReportStatusColumn).find(
      candidate => candidate === status.value,
    );

    if (!column) {
      throw new RangeError(`No report status column for ${status.value}`);
    }

    return column;
  }

  private static verdictColumn(
    verdict: CrossCheckVerdict,
  ): CrossCheckVerdictColumn {
    const column = Object.values(CrossCheckVerdictColumn).find(
      candidate => candidate === verdict.value,
    );

    if (!column) {
      throw new RangeError(
        `No cross-check verdict column for ${verdict.value}`,
      );
    }

    return column;
  }

  private static outcomeColumn(
    outcome: RegistryOutcome,
  ): RegistryOutcomeColumn {
    const column = Object.values(RegistryOutcomeColumn).find(
      candidate => candidate === outcome.value,
    );

    if (!column) {
      throw new RangeError(`No registry outcome column for ${outcome.value}`);
    }

    return column;
  }

  private static issueKindColumn(kind: IssueKind): IssueKindColumn {
    const column = Object.values(IssueKindColumn).find(
      candidate => candidate === kind.value,
    );

    if (!column) {
      throw new RangeError(`No issue kind column for ${kind.value}`);
    }

    return column;
  }
}
