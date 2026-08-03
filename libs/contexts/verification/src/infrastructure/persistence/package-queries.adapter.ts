import { Injectable } from "@nestjs/common";

import { PackageQueries } from "../../application/ports/index.js";
import type {
  PackageDetailView,
  PackageSummaryView,
  ReportView,
} from "../../application/read-models/index.js";
import {
  DocumentType,
  IssueKind,
  type PackageId,
} from "../../domain/value-objects/index.js";
import type { Prisma } from "./generated/client.js";
import { isStoredId } from "./stored-id.js";
import { VerificationPrismaService } from "./verification-prisma.service.js";

const ISSUE_COLUMNS = {
  kind: true,
  message: true,
  documentId: true,
  sourceFileId: true,
  documentType: true,
  fieldName: true,
  pageNumber: true,
  confidence: true,
} as const satisfies Prisma.ValidationIssueSelect;

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
    issues: { orderBy: { createdAt: "asc" }, select: ISSUE_COLUMNS },
  },
} as const satisfies Prisma.VerificationPackage$reportArgs;

type IssueRow = {
  readonly kind: string;
  readonly message: string;
  readonly documentId: string | null;
  readonly sourceFileId: string | null;
  readonly documentType: string | null;
  readonly fieldName: string | null;
  readonly pageNumber: number | null;
  readonly confidence: number | null;
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
export class PrismaPackageQueries extends PackageQueries {
  constructor(private readonly prisma: VerificationPrismaService) {
    super();
  }

  async listSummaries(): Promise<readonly PackageSummaryView[]> {
    const rows = await this.prisma.verificationPackage.findMany({
      orderBy: { createdAt: "desc" },
      select: SUMMARY_COLUMNS,
    });

    return rows.map((row) => PrismaPackageQueries.toSummary(row));
  }

  async findSummary(id: PackageId): Promise<PackageSummaryView | null> {
    if (!isStoredId(id)) return null;

    const row = await this.prisma.verificationPackage.findUnique({
      where: { id: id.value },
      select: SUMMARY_COLUMNS,
    });

    return row ? PrismaPackageQueries.toSummary(row) : null;
  }

  async findDetail(id: PackageId): Promise<PackageDetailView | null> {
    if (!isStoredId(id)) return null;

    const row = await this.prisma.verificationPackage.findUnique({
      where: { id: id.value },
      select: {
        ...SUMMARY_COLUMNS,
        report: REPORT_COLUMNS,
        sourceFiles: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            originalFilename: true,
            contentType: true,
            pages: {
              orderBy: { pageNumber: "asc" },
              select: {
                pageNumber: true,
                ocr: { select: { text: true, confidence: true } },
              },
            },
            documents: {
              orderBy: { firstPage: "asc" },
              select: {
                id: true,
                firstPage: true,
                lastPage: true,
                type: true,
                classificationConfidence: true,
                extractedFields: {
                  orderBy: { createdAt: "asc" },
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
      ...PrismaPackageQueries.toSummary(row),
      report: PrismaPackageQueries.toReport(row.report),
      files: row.sourceFiles.map((file) => ({
        id: file.id,
        originalFilename: file.originalFilename,
        contentType: file.contentType,
        pages: file.pages.map((page) => ({
          pageNumber: page.pageNumber,
          ocr: page.ocr
            ? { text: page.ocr.text, confidence: page.ocr.confidence }
            : null,
        })),
        documents: file.documents.map((document) => ({
          id: document.id,
          firstPage: document.firstPage,
          lastPage: document.lastPage,
          type: document.type,
          classificationConfidence: document.classificationConfidence,
          fields: document.extractedFields.map((field) => ({
            name: field.name,
            value: field.value,
            confidence: field.confidence,
            pageNumber: field.pageNumber,
          })),
        })),
      })),
    };
  }

  private static toReport(row: DetailReportRow | null): ReportView | null {
    if (!row) return null;

    return {
      status: row.status,
      generatedAt: row.generatedAt,
      issues: row.issues.map((issue) => ({
        kind: issue.kind,
        message: issue.message,
        documentId: issue.documentId,
        sourceFileId: issue.sourceFileId,
        documentType: issue.documentType,
        fieldName: issue.fieldName,
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
      classifiedCount: row.documents.filter(
        (document) => document.type !== null,
      ).length,
      unclassifiedCount: row.documents.filter(
        (document) => document.type === DocumentType.UNKNOWN.value,
      ).length,
      extractedCount: row.documents.filter(
        (document) => document._count.extractedFields > 0,
      ).length,
      reportStatus: row.report?.status ?? null,
      // A reading the engine is unsure of is reported apart from a shortfall in
      // the package itself: the register says both, and they do not add up.
      issuesCount: issues.filter(
        (issue) => issue.kind !== IssueKind.LOW_CONFIDENCE.value,
      ).length,
      lowConfidenceCount: issues.filter(
        (issue) => issue.kind === IssueKind.LOW_CONFIDENCE.value,
      ).length,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
