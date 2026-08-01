import type {
  DocumentDto,
  PackageDetailDto,
  PackageDto,
  SourceFileDto,
} from "@cadastre/contracts";

import type {
  DocumentView,
  PackageDetailView,
  PackageSummaryView,
  SourceFileView,
} from "../../application/read-models/index.js";

export function toSummaryDto(view: PackageSummaryView): PackageDto {
  return {
    id: view.id,
    // The read model speaks the storage's strings; the contract's enum is the
    // narrower promise.
    status: view.status as PackageDto["status"],
    profileKey: view.profileKey,
    filesCount: view.filesCount,
    documentsCount: view.documentsCount,
    classifiedCount: view.classifiedCount,
    unclassifiedCount: view.unclassifiedCount,
    extractedCount: view.extractedCount,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

export function toDetailDto(view: PackageDetailView): PackageDetailDto {
  return {
    ...toSummaryDto(view),
    files: view.files.map(toSourceFileDto),
  };
}

function toSourceFileDto(view: SourceFileView): SourceFileDto {
  return {
    id: view.id,
    originalFilename: view.originalFilename,
    // Only ever written through the validated presign flow, so the stored type
    // is one the contract names.
    contentType: view.contentType as SourceFileDto["contentType"],
    pages: view.pages.map((page) => ({
      pageNumber: page.pageNumber,
      ocr: page.ocr
        ? { text: page.ocr.text, confidence: page.ocr.confidence }
        : null,
    })),
    documents: view.documents.map(toDocumentDto),
  };
}

function toDocumentDto(view: DocumentView): DocumentDto {
  return {
    id: view.id,
    firstPage: view.firstPage,
    lastPage: view.lastPage,
    type: view.type,
    classificationConfidence: view.classificationConfidence,
    fields: view.fields.map((field) => ({
      name: field.name,
      value: field.value,
      confidence: field.confidence,
      pageNumber: field.pageNumber,
    })),
  };
}
