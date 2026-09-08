import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import {
  AddFilesRequestSchema,
  CreatePackageRequestSchema,
  type AddFilesRequest,
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

  /*
   * 200 and not 201: what comes back is the package as it now stands, not a
   * resource with an address of its own. A file has no URL here — the bytes
   * were PUT to the store before this call, and the package is the only thing
   * a caller can go and read.
   */
  @Post(':id/files')
  @HttpCode(HttpStatus.OK)
  async addFiles(
    @Param('id') id: string,
    @Body({ schema: AddFilesRequestSchema }) body: AddFilesRequest,
  ): Promise<PackageDto> {
    return this.verification.packages.addFiles(id, body);
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<PackageDetailDto> {
    return this.verification.packages.findOne(id);
  }
}
