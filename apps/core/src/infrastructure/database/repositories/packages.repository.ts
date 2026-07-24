import { Injectable } from "@nestjs/common";

import {
  PackagesRepository,
  type CreatePackageInput,
  type PackageDetail,
  type PackageSummary,
} from "../../../application/ports/packages.repository.js";
import { UNKNOWN_TYPE } from "../../../domain/profiles.js";
import { PrismaService } from "../prisma.service.js";

/** Prisma-backed {@link PackagesRepository} (ADR-0004: infrastructure layer). */
@Injectable()
export class PrismaPackagesRepository extends PackagesRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreatePackageInput): Promise<PackageSummary> {
    const pkg = await this.prisma.verificationPackage.create({
      data: {
        profileKey: input.profileKey,
        documents: { create: input.documents },
      },
      select: this.summarySelect,
    });
    return this.toSummary(pkg);
  }

  async list(): Promise<PackageSummary[]> {
    const rows = await this.prisma.verificationPackage.findMany({
      orderBy: { createdAt: "desc" },
      select: this.summarySelect,
    });
    return rows.map((row) => this.toSummary(row));
  }

  async findDetail(id: string): Promise<PackageDetail | null> {
    const pkg = await this.prisma.verificationPackage.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        profileKey: true,
        createdAt: true,
        updatedAt: true,
        documents: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            originalFilename: true,
            contentType: true,
            type: true,
            pages: {
              orderBy: { pageNumber: "asc" },
              select: {
                pageNumber: true,
                ocr: { select: { text: true, confidence: true } },
              },
            },
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
    });
    if (!pkg) return null;
    return {
      id: pkg.id,
      status: pkg.status,
      profileKey: pkg.profileKey,
      documentsCount: pkg.documents.length,
      classifiedCount: pkg.documents.filter((d) => d.type !== null).length,
      unclassifiedCount: pkg.documents.filter((d) => d.type === UNKNOWN_TYPE)
        .length,
      extractedCount: pkg.documents.filter((d) => d.extractedFields.length > 0)
        .length,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt,
      documents: pkg.documents.map((doc) => ({
        id: doc.id,
        originalFilename: doc.originalFilename,
        contentType: doc.contentType,
        type: doc.type,
        pages: doc.pages.map((page) => ({
          pageNumber: page.pageNumber,
          ocr: page.ocr
            ? { text: page.ocr.text, confidence: page.ocr.confidence }
            : null,
        })),
        fields: doc.extractedFields.map((f) => ({
          name: f.name,
          value: f.value,
          confidence: f.confidence,
          pageNumber: f.pageNumber,
        })),
      })),
    };
  }

  private readonly summarySelect = {
    id: true,
    status: true,
    profileKey: true,
    createdAt: true,
    updatedAt: true,
    // Document types + field counts drive the progress signals.
    documents: {
      select: {
        type: true,
        _count: { select: { extractedFields: true } },
      },
    },
  } as const;

  private toSummary(row: {
    id: string;
    status: PackageSummary["status"];
    profileKey: string;
    createdAt: Date;
    updatedAt: Date;
    documents: { type: string | null; _count: { extractedFields: number } }[];
  }): PackageSummary {
    return {
      id: row.id,
      status: row.status,
      profileKey: row.profileKey,
      documentsCount: row.documents.length,
      classifiedCount: row.documents.filter((d) => d.type !== null).length,
      unclassifiedCount: row.documents.filter((d) => d.type === UNKNOWN_TYPE)
        .length,
      extractedCount: row.documents.filter(
        (d) => d._count.extractedFields > 0,
      ).length,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
