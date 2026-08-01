import { Injectable } from "@nestjs/common";

import { PackageQueries } from "../../application/ports/index.js";
import type {
  PackageDetailView,
  PackageSummaryView,
} from "../../application/read-models/index.js";
import {
  DocumentType,
  type PackageId,
} from "../../domain/value-objects/index.js";
import type { Prisma } from "./generated/client.js";
import { isStoredId } from "./stored-id.js";
import { VerificationPrismaService } from "./verification-prisma.service.js";

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
} as const satisfies Prisma.VerificationPackageSelect;

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

  private static toSummary(row: SummaryRow): PackageSummaryView {
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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
