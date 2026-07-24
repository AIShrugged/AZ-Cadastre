import { Injectable } from "@nestjs/common";

import {
  PackagesRepository,
  type CreatePackageInput,
  type PackageSummary,
} from "../../../application/ports/packages.repository.js";
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

  private readonly summarySelect = {
    id: true,
    status: true,
    profileKey: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { documents: true } },
  } as const;

  private toSummary(row: {
    id: string;
    status: PackageSummary["status"];
    profileKey: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { documents: number };
  }): PackageSummary {
    return {
      id: row.id,
      status: row.status,
      profileKey: row.profileKey,
      documentsCount: row._count.documents,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
