import type {
  DocumentDto,
  PackageDetailDto,
  PackageDto,
} from "@cadastre/contracts";

import type {
  DocumentView,
  PackageDetailView,
  PackageSummaryView,
} from "../../application/read-models/index.js";

export function toSummaryDto(view: PackageSummaryView): PackageDto {
  return {
    id: view.id,
    // The read model speaks the storage's strings; the contract's enum is the
    // narrower promise.
    status: view.status as PackageDto["status"],
    profileKey: view.profileKey,
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
    documents: view.documents.map(toDocumentDto),
  };
}

function toDocumentDto(view: DocumentView): DocumentDto {
  return {
    id: view.id,
    originalFilename: view.originalFilename,
    // Only ever written through the validated presign flow, so the stored type
    // is one the contract names.
    contentType: view.contentType as DocumentDto["contentType"],
    type: view.type,
    classificationConfidence: view.classificationConfidence,
    pages: view.pages.map((page) => ({
      pageNumber: page.pageNumber,
      ocr: page.ocr ? { text: page.ocr.text, confidence: page.ocr.confidence } : null,
    })),
    fields: view.fields.map((field) => ({
      name: field.name,
      value: field.value,
      confidence: field.confidence,
      pageNumber: field.pageNumber,
    })),
  };
}
