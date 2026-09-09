import type {
  ApprovedCheckDto,
  ArchiveSearchApprovalDto,
  ArchiveTallyDto,
  CheckedValueDto,
  CrossCheckDto,
  DocumentDto,
  FindingCountDto,
  FindingTallyDto,
  ListPackagesRequest,
  ListPackagesResponse,
  OutcomeTallyDto,
  PackageDetailDto,
  PackageDto,
  PackagesOverviewRequest,
  PackagesOverviewResponse,
  PipelineTallyDto,
  RegistryCheckDto,
  RegistryDocumentDto,
  ReportDto,
  SourceFileDto,
  StatedValueDto,
} from '@cadastre/api-contracts/verification';

import type { PackageListPage } from '../../ports/outbound/index.js';
import type {
  ApprovedCheckView,
  ArchiveSearchApprovalView,
  CheckedValueView,
  CrossCheckView,
  DocumentView,
  FindingTallyView,
  PackageDetailView,
  PackagesOverviewView,
  PackageSummaryView,
  RegistryCheckView,
  ReportView,
  SourceFileView,
  StatedValueView,
} from '../../read-models/index.js';

export function toSummaryDto(view: PackageSummaryView): PackageDto {
  return {
    id: view.id,
    // The read model speaks the storage's strings; the contract's enum is the
    // narrower promise.
    status: view.status as PackageDto['status'],
    // Only ever worked out through the domain's own enumeration, so the string
    // is one the contract names.
    standing: view.standing as PackageDto['standing'],
    profileKey: view.profileKey,
    // What the case is called, off the papers the package's own profile
    // believes each value from. Carried across as read: the register decided
    // which reading answers, and a second opinion here would be a second rule.
    applicantName: toStatedValueDto(view.applicantName),
    propertyAddress: toStatedValueDto(view.propertyAddress),
    cadastralNumber: toStatedValueDto(view.cadastralNumber),
    // Only ever worked out through the domain's own enumeration, so the string
    // is one the contract names.
    archiveOutcome: view.archiveOutcome as PackageDto['archiveOutcome'],
    archiveSearchApproved: view.archiveSearchApproved,
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

// One of the three values a row names the case by. Null stays null: a row that
// cannot name the case says so rather than showing an empty string, which a
// reader would take for a value somebody left blank.
function toStatedValueDto(view: StatedValueView | null): StatedValueDto | null {
  return view ? { value: view.value, confidence: view.confidence } : null;
}

/**
 * One page of the list as the caller gets it: the rows, how many the criteria
 * matched, and which page this is. The last two are echoed off the request that
 * asked for it, so a late answer cannot be rendered as the page asked for after
 * it.
 */
export function toListDto(
  page: PackageListPage,
  request: ListPackagesRequest,
): ListPackagesResponse {
  return {
    items: page.items.map(toSummaryDto),
    total: page.total,
    limit: request.limit,
    offset: request.offset,
  };
}

/**
 * The four tallies as the caller gets them, with the period they are about
 * echoed off the request that asked for it — the same reason one page of the
 * list echoes its `limit` and `offset`: an answer that arrives late must not be
 * rendered under the period asked for after it.
 *
 * The counts come over as they were counted. Every key of a `byMember` record
 * was built from the domain's own enumeration, so the strings are ones the
 * contract names, and there is no member of a vocabulary missing from one.
 */
export function toOverviewDto(
  view: PackagesOverviewView,
  request: PackagesOverviewRequest,
): PackagesOverviewResponse {
  return {
    period: {
      from: request.from ?? null,
      to: request.to ?? null,
    },
    pipeline: {
      total: view.pipeline.total,
      byStatus: view.pipeline.byMember as PipelineTallyDto['byStatus'],
    },
    outcomes: {
      total: view.outcomes.total,
      byStatus: view.outcomes.byMember as OutcomeTallyDto['byStatus'],
    },
    findings: {
      againstPackage: toFindingTallyDto(view.findings.againstPackage),
      observations: toFindingTallyDto(view.findings.observations),
    },
    archive: {
      total: view.archive.total,
      byOutcome: view.archive.byMember as ArchiveTallyDto['byOutcome'],
    },
  };
}

/**
 * One group of findings, in the order the register put them in. The order is
 * the answer — most frequent first — so it is carried through rather than
 * re-decided here.
 */
function toFindingTallyDto(view: FindingTallyView): FindingTallyDto {
  return {
    total: view.total,
    byKind: view.byKind.map(row => ({
      // Every kind the register tallied is one the report wrote, and the
      // report writes the domain's own enumeration.
      kind: row.kind as FindingCountDto['kind'],
      count: row.count,
    })),
  };
}

export function toDetailDto(view: PackageDetailView): PackageDetailDto {
  return {
    ...toSummaryDto(view),
    files: view.files.map(toSourceFileDto),
    crossChecks: view.crossChecks.map(toCrossCheckDto),
    registryChecks: view.registryChecks.map(toRegistryCheckDto),
    archiveSearchApprovals: view.archiveSearchApprovals.map(toApprovalDto),
    report: view.report ? toReportDto(view.report) : null,
  };
}

// A spent approval comes over with the rest: `supersededAt` is what says a
// person signed for answers the package has since replaced, and a reader who
// cannot see that is a reader being told nothing happened (ADR-0016).
function toApprovalDto(
  view: ArchiveSearchApprovalView,
): ArchiveSearchApprovalDto {
  return {
    approvedAt: view.approvedAt.toISOString(),
    supersededAt: view.supersededAt?.toISOString() ?? null,
    summary: view.summary,
    comment: view.comment,
    checks: view.checks.map((check: ApprovedCheckView) => ({
      key: check.key,
      // Only ever written through the domain's own enumeration, so the stored
      // string is one the contract names.
      outcome: check.outcome as ApprovedCheckDto['outcome'],
    })),
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
    values: view.values.map(toCheckedValueDto),
  };
}

// The value a check was made from — a cross-check's, or the address a registry
// check asked about. Same six fields either way.
function toCheckedValueDto(view: CheckedValueView): CheckedValueDto {
  return {
    documentId: view.documentId,
    documentType: view.documentType,
    fieldName: view.fieldName,
    value: view.value,
    pageNumber: view.pageNumber,
    confidence: view.confidence,
  };
}

function toRegistryCheckDto(view: RegistryCheckView): RegistryCheckDto {
  return {
    key: view.key,
    // Only ever written through the domain's own enumeration, so the stored
    // string is one the contract names.
    outcome: view.outcome as RegistryCheckDto['outcome'],
    confidence: view.confidence,
    note: view.note,
    asked: toCheckedValueDto(view.asked),
    reference: view.reference,
    attributes: view.attributes.map(attribute => ({
      name: attribute.name,
      submitted: toCheckedValueDto(attribute.submitted),
      recorded: attribute.recorded,
      agrees: attribute.agrees,
    })),
    documents: view.documents.map(document => ({
      name: document.name,
      type: document.documentType,
      documentId: document.documentId,
      pageNumber: document.pageNumber,
      // Only ever written through the domain's own enumeration, so the stored
      // string is one the contract names.
      holding: document.holding as RegistryDocumentDto['holding'],
      number: document.number,
      issuedOn: document.issuedOn,
      reference: document.reference,
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
