import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import {
  CreatePackageRequestSchema,
  type PackageDto,
} from "@cadastre/contracts";

import {
  PackagesRepository,
  type PackageSummary,
} from "../application/ports/packages.repository.js";

function toDto(p: PackageSummary): PackageDto {
  return {
    id: p.id,
    status: p.status,
    profileKey: p.profileKey,
    documentsCount: p.documentsCount,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Controller("packages")
export class PackagesController {
  constructor(private readonly packages: PackagesRepository) {}

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
}
