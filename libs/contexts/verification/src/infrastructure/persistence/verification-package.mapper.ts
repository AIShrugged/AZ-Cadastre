import { VerificationPackage } from "../../domain/aggregates/index.js";
import { Document, ExtractedField, Page } from "../../domain/entities/index.js";
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
  PageNumber,
  RecognisedText,
  StorageKey,
  VerificationProfile,
} from "../../domain/value-objects/index.js";
import { PackageStatus as StatusColumn } from "./generated/client.js";

export type PackageRow = {
  readonly id: string;
  readonly status: string;
  readonly profileKey: string;
  readonly version: number;
  readonly documents: readonly DocumentRow[];
};

export type DocumentRow = {
  readonly id: string;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly storageKey: string;
  readonly type: string | null;
  readonly classificationConfidence: number | null;
  readonly pages: readonly PageRow[];
  readonly extractedFields: readonly FieldRow[];
};

export type PageRow = {
  readonly id: string;
  readonly pageNumber: number;
  readonly imageStorageKey: string;
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
  readonly documents: readonly DocumentWrite[];
};

export type DocumentWrite = {
  readonly id: string;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly storageKey: string;
  readonly type: string | null;
  readonly classificationConfidence: number | null;
  readonly pages: readonly PageWrite[];
  readonly fields: readonly FieldWrite[];
};

export type PageWrite = {
  readonly id: string;
  readonly pageNumber: number;
  readonly imageStorageKey: string;
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
      documents: aggregate.documents.map((document) => ({
        id: document.id.value,
        originalFilename: document.filename.value,
        contentType: document.contentType.value,
        storageKey: document.storageKey.value,
        type: document.classification?.type.value ?? null,
        classificationConfidence:
          document.classification?.confidence.value ?? null,
        pages: document.pages.map((page) => ({
          id: page.id.value,
          pageNumber: page.number.value,
          imageStorageKey: page.imageStorageKey.value,
          ocr: page.ocr
            ? {
                text: page.ocr.text.value,
                confidence: page.ocr.confidence.value,
              }
            : null,
        })),
        fields: document.fields.map((field) => ({
          name: field.key.value,
          value: field.value.value,
          confidence: field.confidence.value,
          pageNumber: field.foundOn.value,
        })),
      })),
    };
  }

  private static documentToDomain(row: DocumentRow): Document {
    return Document.restore({
      id: DocumentId.of(row.id),
      filename: Filename.create(row.originalFilename),
      contentType: ContentType.of(row.contentType),
      storageKey: StorageKey.create(row.storageKey),
      pages: row.pages.map((page) =>
        VerificationPackageMapper.pageToDomain(page),
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
      StorageKey.create(row.imageStorageKey),
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
