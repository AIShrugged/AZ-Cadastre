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

import type { AccountDto } from '@cadastre/api-contracts/accounts';
import {
  AddFilesRequestSchema,
  ApproveArchiveSearchRequestSchema,
  CreatePackageRequestSchema,
  ListPackagesRequestSchema,
  PackagesOverviewRequestSchema,
  SupplyDocumentRequestSchema,
  type AddFilesRequest,
  type ApproveArchiveSearchRequest,
  type CreatePackageRequest,
  type ListPackagesRequest,
  type ListPackagesResponse,
  type PackageDetailDto,
  type PackageDto,
  type PackagesOverviewRequest,
  type PackagesOverviewResponse,
  type SupplyDocumentRequest,
} from '@cadastre/api-contracts/verification';

import { VerificationClientPort } from '../../../application/ports/index.js';
import {
  CurrentAccount,
  RequiresRole,
  scopeFor,
} from '../../http/session/index.js';

@Controller('packages')
export class PackagesController {
  constructor(private readonly verification: VerificationClientPort) {}

  /*
   * Either role may file one, and the case belongs to whoever filed it. The
   * owner comes off the session and never off the body: a request that could
   * name its own owner would be a request that could file a case in somebody
   * else's name (ADR-0029).
   */
  @Post()
  async create(
    @Body({ schema: CreatePackageRequestSchema }) body: CreatePackageRequest,
    @CurrentAccount() account: AccountDto,
  ): Promise<PackageDto> {
    return this.verification.packages.create(body, account.id);
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
    @CurrentAccount() account: AccountDto,
  ): Promise<ListPackagesResponse> {
    // The office reads the whole register; an applicant reads their own
    // submissions. Not a filter the query string can ask for — the scope is the
    // session's, which is why it travels beside the request and not inside it.
    return this.verification.packages.findMany(query, scopeFor(account));
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
    @CurrentAccount() account: AccountDto,
  ): Promise<PackageDto> {
    return this.verification.packages.addFiles(id, body, scopeFor(account));
  }

  /*
   * One document, sent in for one of the gaps `GET /packages/:id` publishes
   * (COMM-80).
   *
   * Under `documents` and not under `files`, because the two are different
   * asks: `POST :id/files` is more of the envelope, any number of files
   * answering nothing in particular, and this is one file that answers
   * something — the paper the package said it was short of, and where it is a
   * replacement, the document it stands in for.
   *
   * 200 and not 201, like `files` above: what comes back is the package as it
   * now stands. The document has no address of its own to be created at — it is
   * not a document yet, only a file the run has still to read into one.
   */
  @Post(':id/documents')
  @HttpCode(HttpStatus.OK)
  async supplyDocument(
    @Param('id') id: string,
    @Body({ schema: SupplyDocumentRequestSchema }) body: SupplyDocumentRequest,
    @CurrentAccount() account: AccountDto,
  ): Promise<PackageDto> {
    return this.verification.packages.supplyDocument(
      id,
      body,
      scopeFor(account),
    );
  }

  /*
   * The one write here a person makes rather than the engine: their approval of
   * what the archive register answered about this submission (ADR-0016).
   *
   * The office's own, and the guard below is the one that was promised here
   * when this endpoint was written: the restriction used to be written down and
   * unenforced because there was nothing to enforce it with, and accounts are
   * what arrived (ADR-0029). An applicant gets a 403 — not a 404, because it is
   * the route and not the case that is none of their business.
   *
   * It still carries no author. Who approved a search is a separate question
   * from who may, and ADR-0016 says an approval has no author today; adding one
   * is a change to the approval, not to this guard.
   *
   * 200 and not 201: what comes back is the package as it now stands, and the
   * approval has no address of its own to be created at.
   */
  @Post(':id/archive-search-approval')
  @RequiresRole('operator')
  @HttpCode(HttpStatus.OK)
  async approveArchiveSearch(
    @Param('id') id: string,
    @Body({ schema: ApproveArchiveSearchRequestSchema })
    body: ApproveArchiveSearchRequest,
  ): Promise<PackageDetailDto> {
    return this.verification.packages.approveArchiveSearch(id, body);
  }

  /*
   * Declared before `:id`, and it has to be: Nest matches routes in the order
   * they are declared, so under the parameter route this path would arrive as
   * a package whose id is the word "overview" and come back a 404.
   *
   * The whole period is the query string, and the schema is what says so — a
   * bound that is not an ISO-8601 instant, or a period that ends before it
   * starts, is a 400 from here and never a call into the context. Naming
   * neither bound is every submission the office has ever taken in. What the
   * four slices are and why they arrive together: ADR-0017.
   *
   * The office's own measure of itself, so the office alone may ask for it: it
   * is counted over every submission there is, and there is no version of it
   * narrowed to one applicant's that would mean anything (ADR-0029).
   */
  @Get('overview')
  @RequiresRole('operator')
  async overview(
    @Query({ schema: PackagesOverviewRequestSchema })
    query: PackagesOverviewRequest,
  ): Promise<PackagesOverviewResponse> {
    return this.verification.packages.overview(query);
  }

  /*
   * A submission that is not this applicant's comes back 404 and never 403: a
   * 403 on a case that exists tells a stranger it exists, which is exactly what
   * an id they guessed was for (ADR-0029). The context answers it, not this
   * route — the scope is part of the read, so there is no moment where the row
   * has been fetched and then discarded.
   */
  @Get(':id')
  async detail(
    @Param('id') id: string,
    @CurrentAccount() account: AccountDto,
  ): Promise<PackageDetailDto> {
    return this.verification.packages.findOne(id, scopeFor(account));
  }
}
