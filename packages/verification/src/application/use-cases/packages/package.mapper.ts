import type {
  CrossCheckDto,
  DocumentDto,
  PackageDetailDto,
  PackageDto,
  ReportDto,
  SourceFileDto,
} from '@cadastre/api-contracts/verification';

import type {
  CrossCheckView,
  DocumentView,
  PackageDetailView,
  PackageSummaryView,
  ReportView,
  SourceFileView,
} from '../../read-models/index.js';

export function toSummaryDto(view: PackageSummaryView): PackageDto {
  return {
    id: view.id,
    // The read model speaks the storage's strings; the contract's enum is the
    // narrower promise.
    status: view.status as PackageDto['status'],
    profileKey: view.profileKey,
    filesCount: view.filesCount,
    documentsCount: view.documentsCount,
    classifiedCount: view.classifiedCount,
    unclassifiedCount: view.unclassifiedCount,
    extractedCount: view.extractedCount,
    reportStatus: view.reportStatus as PackageDto['reportStatus'],
    issuesCount: view.issuesCount,
    lowConfidenceCount: view.lowConfidenceCount,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

export function toDetailDto(view: PackageDetailView): PackageDetailDto {
  return {
    ...toSummaryDto(view),
    files: view.files.map(toSourceFileDto),
    crossChecks: view.crossChecks.map(toCrossCheckDto),
    report: view.report ? toReportDto(view.report) : null,
  };
}

function toCrossCheckDto(view: CrossCheckView): CrossCheckDto {
  return {
    key: view.key,
    // Only ever written through the domain's own enumeration, so the stored
    // string is one the contract names.
    verdict: view.verdict as CrossCheckDto['verdict'],
    confidence: view.confidence,
    note: view.note,
    values: view.values.map(value => ({
      documentId: value.documentId,
      documentType: value.documentType,
      fieldName: value.fieldName,
      value: value.value,
      pageNumber: value.pageNumber,
      confidence: value.confidence,
    })),
  };
}

function toReportDto(view: ReportView): ReportDto {
  return {
    // Only ever written through the domain's own enumerations, so the stored
    // strings are ones the contract names.
    status: view.status as ReportDto['status'],
    generatedAt: view.generatedAt.toISOString(),
    issues: view.issues.map(issue => ({
      kind: issue.kind as ReportDto['issues'][number]['kind'],
      message: issue.message,
      documentId: issue.documentId,
      sourceFileId: issue.sourceFileId,
      documentType: issue.documentType,
      fieldName: issue.fieldName,
      checkKey: issue.checkKey,
      pageNumber: issue.pageNumber,
      confidence: issue.confidence,
    })),
  };
}

function toSourceFileDto(view: SourceFileView): SourceFileDto {
  return {
    id: view.id,
    originalFilename: view.originalFilename,
    // Only ever written through the validated presign flow, so the stored type
    // is one the contract names.
    contentType: view.contentType as SourceFileDto['contentType'],
    pages: view.pages.map(page => ({
      pageNumber: page.pageNumber,
      imageUrl: page.imageUrl,
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
    fields: view.fields.map(field => ({
      name: field.name,
      value: field.value,
      confidence: field.confidence,
      pageNumber: field.pageNumber,
    })),
  };
}
