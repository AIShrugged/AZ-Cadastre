import { VerificationPackage } from "../../domain/aggregates/index.js";
import {
  Document,
  ExtractedField,
  Page,
  SourceFile,
} from "../../domain/entities/index.js";
import {
  Classification,
  Confidence,
  ContentType,
  DocumentId,
  DocumentType,
  FieldKey,
  FieldValue,
  Filename,
  OcrResult,
  PackageId,
  PackageStatus,
  PageId,
  PageImage,
  PageNumber,
  PageRange,
  RecognisedText,
  SourceFileId,
  StorageKey,
  VerificationProfile,
} from "../../domain/value-objects/index.js";
import { PackageStatus as StatusColumn } from "./generated/client.js";

export type PackageRow = {
  readonly id: string;
  readonly status: string;
  readonly profileKey: string;
  readonly version: number;
  readonly sourceFiles: readonly SourceFileRow[];
  readonly documents: readonly DocumentRow[];
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
      files: row.sourceFiles.map((file) =>
        VerificationPackageMapper.fileToDomain(file),
      ),
      documents: row.documents.map((document) =>
        VerificationPackageMapper.documentToDomain(document),
      ),
    });
  }

  static toRow(aggregate: VerificationPackage): PackageWrite {
    return {
      id: aggregate.id.value,
      status: VerificationPackageMapper.statusColumn(aggregate.status),
      profileKey: aggregate.profile.key,
      sourceFiles: aggregate.files.map((file) => ({
        id: file.id.value,
        originalFilename: file.filename.value,
        contentType: file.contentType.value,
        storageKey: file.storageKey.value,
        pages: file.pages.map((page) => ({
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
      documents: aggregate.documents.map((document) => ({
        id: document.id.value,
        sourceFileId: document.sourceFileId.value,
        firstPage: document.pages.first.value,
        lastPage: document.pages.last.value,
        type: document.classification?.type.value ?? null,
        classificationConfidence:
          document.classification?.confidence.value ?? null,
        fields: document.fields.map((field) => ({
          name: field.key.value,
          value: field.value.value,
          confidence: field.confidence.value,
          pageNumber: field.foundOn.value,
        })),
      })),
    };
  }

  private static fileToDomain(row: SourceFileRow): SourceFile {
    return SourceFile.restore({
      id: SourceFileId.of(row.id),
      filename: Filename.create(row.originalFilename),
      contentType: ContentType.of(row.contentType),
      storageKey: StorageKey.create(row.storageKey),
      pages: row.pages.map((page) =>
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
      fields: row.extractedFields.map((field) =>
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

    return Classification.of(DocumentType.create(row.type), confidence);
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
      (candidate) => candidate === status.value,
    );

    if (!column) {
      throw new RangeError(`No status column for ${status.value}`);
    }

    return column;
  }
}
