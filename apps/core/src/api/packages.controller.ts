import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import {
  CreatePackageRequestSchema,
  type PackageDetailDto,
  type PackageDto,
} from "@cadastre/contracts";

import { PackagesService } from "../application/packages/packages.service.js";
import type {
  PackageDetail,
  PackageSummary,
} from "../application/ports/packages.repository.js";

function toDto(p: PackageSummary): PackageDto {
  return {
    id: p.id,
    status: p.status,
    profileKey: p.profileKey,
    documentsCount: p.documentsCount,
    classifiedCount: p.classifiedCount,
    unclassifiedCount: p.unclassifiedCount,
    extractedCount: p.extractedCount,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toDetailDto(p: PackageDetail): PackageDetailDto {
  return {
    ...toDto(p),
    documents: p.documents.map((doc) => ({
      id: doc.id,
      originalFilename: doc.originalFilename,
      // The DTO narrows contentType to the accepted upload types; documents are
      // only ever created through the validated presign/create flow.
      contentType: doc.contentType as PackageDetailDto["documents"][number]["contentType"],
      type: doc.type,
      pages: doc.pages.map((page) => ({
        pageNumber: page.pageNumber,
        ocr: page.ocr,
      })),
      fields: doc.fields,
    })),
  };
}

@Controller("packages")
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  /** Create a Verification Package from already-uploaded documents (step 1). */
  @Post()
  async create(@Body() body: unknown): Promise<PackageDto> {
    const parsed = CreatePackageRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(z.flattenError(parsed.error));
    }
    const created = await this.packages.create(parsed.data);
    return toDto(created);
  }

  /** List packages for the register/dashboard, newest first. */
  @Get()
  async list(): Promise<PackageDto[]> {
    const rows = await this.packages.list();
    return rows.map(toDto);
  }

  /** One package with its documents, pages, OCR results and detected types. */
  @Get(":id")
  async detail(@Param("id") id: string): Promise<PackageDetailDto> {
    const detail = await this.packages.getById(id);
    if (!detail) {
      throw new NotFoundException(`Package ${id} not found`);
    }
    return toDetailDto(detail);
  }
}
