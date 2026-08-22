import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import {
  CreatePackageRequestSchema,
  type CreatePackageRequest,
  type PackageDetailDto,
  type PackageDto,
} from '@cadastre/api-contracts/verification';

import { VerificationClientPort } from '../../../application/ports/index.js';

@Controller('packages')
export class PackagesController {
  constructor(private readonly verification: VerificationClientPort) {}

  @Post()
  async create(
    @Body({ schema: CreatePackageRequestSchema }) body: CreatePackageRequest,
  ): Promise<PackageDto> {
    return this.verification.packages.create(body);
  }

  @Get()
  async list(): Promise<PackageDto[]> {
    return this.verification.packages.findMany();
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<PackageDetailDto> {
    return this.verification.packages.findOne(id);
  }
}
