import { Injectable } from '@nestjs/common';

import { PackageQueries } from '../../application/ports/outbound/index.js';
import type {
  CrossCheckView,
  PackageDetailView,
  PackageSummaryView,
  ReportView,
} from '../../application/read-models/index.js';
import {
  DocumentType,
  IssueKind,
  type PackageId,
} from '../../domain/value-objects/index.js';

import type { Prisma } from './generated/client.js';
import { isStoredId } from './stored-id.js';
import { VerificationPrismaService } from './verification-prisma.service.js';

const ISSUE_COLUMNS = {
  kind: true,
  message: true,
  documentId: true,
  sourceFileId: true,
  documentType: true,
  fieldName: true,
  checkKey: true,
  pageNumber: true,
  confidence: true,
} as const satisfies Prisma.ValidationIssueSelect;

const CROSS_CHECK_COLUMNS = {
  orderBy: { key: 'asc' },
  select: {
    key: true,
    verdict: true,
    confidence: true,
    note: true,
    values: {
      orderBy: { position: 'asc' },
      select: {
        documentId: true,
        documentType: true,
        fieldName: true,
        value: true,
        pageNumber: true,
        confidence: true,
      },
    },
  },
} as const satisfies Prisma.VerificationPackage$crossChecksArgs;

const SUMMARY_COLUMNS = {
  id: true,
  status: true,
  profileKey: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { sourceFiles: true } },
  documents: {
    select: {
      type: true,
      _count: { select: { extractedFields: true } },
    },
  },
  // The register only tallies findings; the whole of each one is the detail
  // view's business.
  report: { select: { status: true, issues: { select: { kind: true } } } },
} as const satisfies Prisma.VerificationPackageSelect;

const REPORT_COLUMNS = {
  select: {
    status: true,
    generatedAt: true,
    issues: { orderBy: { createdAt: 'asc' }, select: ISSUE_COLUMNS },
  },
} as const satisfies Prisma.VerificationPackage$reportArgs;

type IssueRow = {
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

type CrossCheckRow = {
  readonly key: string;
  readonly verdict: string;
  readonly confidence: number;
  readonly note: string;
  readonly values: readonly {
    readonly documentId: string | null;
    readonly documentType: string;
    readonly fieldName: string;
    readonly value: string;
    readonly pageNumber: number;
    readonly confidence: number;
  }[];
};

type SummaryRow = {
  readonly id: string;
  readonly status: string;
  readonly profileKey: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly _count: { readonly sourceFiles: number };
  readonly documents: readonly {
    readonly type: string | null;
    readonly _count: { readonly extractedFields: number };
  }[];
  readonly report: {
    readonly status: string;
    readonly issues: readonly { readonly kind: string }[];
  } | null;
};

type DetailReportRow = {
  readonly status: string;
  readonly generatedAt: Date;
  readonly issues: readonly IssueRow[];
};

@Injectable()
export class PackageQueriesAdapter extends PackageQueries {
  constructor(private readonly prisma: VerificationPrismaService) {
    super();
  }

  async listSummaries(): Promise<readonly PackageSummaryView[]> {
    const rows = await this.prisma.verificationPackage.findMany({
      orderBy: { createdAt: 'desc' },
      select: SUMMARY_COLUMNS,
    });

    return rows.map(row => PackageQueriesAdapter.toSummary(row));
  }

  async findSummary(id: PackageId): Promise<PackageSummaryView | null> {
    if (!isStoredId(id)) return null;

    const row = await this.prisma.verificationPackage.findUnique({
      where: { id: id.value },
      select: SUMMARY_COLUMNS,
    });

    return row ? PackageQueriesAdapter.toSummary(row) : null;
  }

  async findDetail(id: PackageId): Promise<PackageDetailView | null> {
    if (!isStoredId(id)) return null;

    const row = await this.prisma.verificationPackage.findUnique({
      where: { id: id.value },
      select: {
        ...SUMMARY_COLUMNS,
        report: REPORT_COLUMNS,
        crossChecks: CROSS_CHECK_COLUMNS,
        sourceFiles: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            originalFilename: true,
            contentType: true,
            pages: {
              orderBy: { pageNumber: 'asc' },
              select: {
                pageNumber: true,
                imageStorageKey: true,
                ocr: { select: { text: true, confidence: true } },
              },
            },
            documents: {
              orderBy: { firstPage: 'asc' },
              select: {
                id: true,
                firstPage: true,
                lastPage: true,
                type: true,
                classificationConfidence: true,
                extractedFields: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    name: true,
                    value: true,
                    confidence: true,
                    pageNumber: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!row) return null;

    return {
      ...PackageQueriesAdapter.toSummary(row),
      report: PackageQueriesAdapter.toReport(row.report),
      crossChecks: row.crossChecks.map(check =>
        PackageQueriesAdapter.toCrossCheck(check),
      ),
      files: row.sourceFiles.map(file => ({
        id: file.id,
        originalFilename: file.originalFilename,
        contentType: file.contentType,
        pages: file.pages.map(page => ({
          pageNumber: page.pageNumber,
          imageStorageKey: page.imageStorageKey,
          // Signed by the use case, which is where reaching object storage
          // belongs; the register only knows where the sheet is kept.
          imageUrl: null,
          ocr: page.ocr
            ? { text: page.ocr.text, confidence: page.ocr.confidence }
            : null,
        })),
        documents: file.documents.map(document => ({
          id: document.id,
          firstPage: document.firstPage,
          lastPage: document.lastPage,
          type: document.type,
          classificationConfidence: document.classificationConfidence,
          fields: document.extractedFields.map(field => ({
            name: field.name,
            value: field.value,
            confidence: field.confidence,
            pageNumber: field.pageNumber,
          })),
        })),
      })),
    };
  }

  private static toCrossCheck(row: CrossCheckRow): CrossCheckView {
    return {
      key: row.key,
      verdict: row.verdict,
      confidence: row.confidence,
      note: row.note,
      values: row.values.map(value => ({
        documentId: value.documentId,
        documentType: value.documentType,
        fieldName: value.fieldName,
        value: value.value,
        pageNumber: value.pageNumber,
        confidence: value.confidence,
      })),
    };
  }

  private static toReport(row: DetailReportRow | null): ReportView | null {
    if (!row) return null;

    return {
      status: row.status,
      generatedAt: row.generatedAt,
      issues: row.issues.map(issue => ({
        kind: issue.kind,
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

  private static toSummary(row: SummaryRow): PackageSummaryView {
    const issues = row.report?.issues ?? [];

    return {
      id: row.id,
      status: row.status,
      profileKey: row.profileKey,
      filesCount: row._count.sourceFiles,
      // Zero until the Segmentation stage has read the files: how many
      // documents a package holds is something the pipeline discovers, not
      // something the upload declared.
      documentsCount: row.documents.length,
      classifiedCount: row.documents.filter(document => document.type !== null)
        .length,
      unclassifiedCount: row.documents.filter(
        document => document.type === DocumentType.UNKNOWN.value,
      ).length,
      extractedCount: row.documents.filter(
        document => document._count.extractedFields > 0,
      ).length,
      reportStatus: row.report?.status ?? null,
      // A reading the engine is unsure of is reported apart from a shortfall in
      // the package itself: the register says both, and they do not add up.
      issuesCount: issues.filter(
        issue => issue.kind !== IssueKind.LOW_CONFIDENCE.value,
      ).length,
      lowConfidenceCount: issues.filter(
        issue => issue.kind === IssueKind.LOW_CONFIDENCE.value,
      ).length,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
