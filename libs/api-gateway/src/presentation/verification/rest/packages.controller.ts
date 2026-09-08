import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import {
  AddFilesRequestSchema,
  ApproveArchiveSearchRequestSchema,
  CreatePackageRequestSchema,
  ListPackagesRequestSchema,
  type AddFilesRequest,
  type ApproveArchiveSearchRequest,
  type CreatePackageRequest,
  type ListPackagesRequest,
  type ListPackagesResponse,
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

  /*
   * The query string is the whole of what this takes, and the schema is what
   * says so: a page size of 500 or a standing nobody names is a 400 from here,
   * never a call into the context. The defaults it fills in — the first page,
   * twenty rows — are what a caller that asks for nothing gets.
   */
  @Get()
  async list(
    @Query({ schema: ListPackagesRequestSchema }) query: ListPackagesRequest,
  ): Promise<ListPackagesResponse> {
    return this.verification.packages.findMany(query);
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

  /*
   * The one write here a person makes rather than the engine: their approval of
   * what the archive register answered about this submission (ADR-0016).
   *
   * Only an administrator may approve one. Nothing here enforces that and
   * nothing can: there is no authentication and there are no accounts, so this
   * endpoint cannot tell an administrator from anybody else, and a check it
   * could make — a name in the body, a header a caller sets — would be a lock
   * with the key taped to it. The restriction is written down and unenforced
   * rather than faked, and this is the one place a guard attaches when accounts
   * arrive.
   *
   * 200 and not 201: what comes back is the package as it now stands, and the
   * approval has no address of its own to be created at.
   */
  @Post(':id/archive-search-approval')
  @HttpCode(HttpStatus.OK)
  async approveArchiveSearch(
    @Param('id') id: string,
    @Body({ schema: ApproveArchiveSearchRequestSchema })
    body: ApproveArchiveSearchRequest,
  ): Promise<PackageDetailDto> {
    return this.verification.packages.approveArchiveSearch(id, body);
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<PackageDetailDto> {
    return this.verification.packages.findOne(id);
  }
}
