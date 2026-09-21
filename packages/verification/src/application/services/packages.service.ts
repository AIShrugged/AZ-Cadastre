import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import type {
  AddFilesRequest,
  ApproveArchiveSearchRequest,
  CreatePackageRequest,
  ListPackagesRequest,
  ListPackagesResponse,
  PackageDetailDto,
  PackageDto,
  PackagesApi,
  PackageScope,
  PackagesOverviewRequest,
  PackagesOverviewResponse,
  SupplyDocumentRequest,
} from '@cadastre/api-contracts/verification';

import {
  AddFilesCommand,
  ApproveArchiveSearchCommand,
  CreatePackageCommand,
  GetPackageQuery,
  GetPackagesOverviewQuery,
  GetPackageSummaryQuery,
  ListPackagesQuery,
  SupplyDocumentCommand,
} from '../use-cases/index.js';
import {
  toDetailDto,
  toListDto,
  toOverviewDto,
  toSummaryDto,
} from '../use-cases/packages/index.js';

/**
 * Implements the contract's packages slice and does nothing else: one dispatch
 * to a use case, one mapper call. No rule lives here.
 */
@Injectable()
export class PackagesService implements PackagesApi {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  async create(
    request: CreatePackageRequest,
    ownerAccountId: string | null,
  ): Promise<PackageDto> {
    const packageId = await this.commands.execute(
      new CreatePackageCommand(
        request.profileKey,
        request.files,
        // The operator's own choice of profile, and what they declared about
        // the case beside it. A request that declares nothing is the one this
        // endpoint has always taken.
        request.declared ?? {},
        ownerAccountId,
      ),
    );

    return toSummaryDto(
      await this.queries.execute(new GetPackageSummaryQuery(packageId.value)),
    );
  }

  async addFiles(
    id: string,
    request: AddFilesRequest,
    scope: PackageScope,
  ): Promise<PackageDto> {
    const packageId = await this.commands.execute(
      new AddFilesCommand(id, request.files, ownerOf(scope)),
    );

    return toSummaryDto(
      await this.queries.execute(new GetPackageSummaryQuery(packageId.value)),
    );
  }

  async supplyDocument(
    id: string,
    request: SupplyDocumentRequest,
    scope: PackageScope,
  ): Promise<PackageDto> {
    const packageId = await this.commands.execute(
      new SupplyDocumentCommand(
        id,
        request.file,
        request.expectedType,
        request.replacesDocumentId ?? null,
        ownerOf(scope),
      ),
    );

    return toSummaryDto(
      await this.queries.execute(new GetPackageSummaryQuery(packageId.value)),
    );
  }

  /*
   * Answers with the whole package rather than the row: the approval shows on
   * the submission a caller was already looking at, and asking for it again to
   * see what one has just written is a round trip for nothing.
   */
  async approveArchiveSearch(
    id: string,
    request: ApproveArchiveSearchRequest,
  ): Promise<PackageDetailDto> {
    const packageId = await this.commands.execute(
      new ApproveArchiveSearchCommand(id, request.summary, request.comment),
    );

    /*
     * `null` and not the caller's own account: only the office may approve an
     * archive search, so the call that gets here is never an applicant's, and
     * scoping the read that follows it to an account would be scoping it to
     * nobody (ADR-0029).
     */
    return this.findOne(packageId.value, null);
  }

  async findMany(
    request: ListPackagesRequest,
    scope: PackageScope,
  ): Promise<ListPackagesResponse> {
    const page = await this.queries.execute(
      new ListPackagesQuery(
        request.search,
        request.standing,
        request.reportStatus,
        request.limit,
        request.offset,
        ownerOf(scope),
      ),
    );

    return toListDto(page, request);
  }

  async findOne(id: string, scope: PackageScope): Promise<PackageDetailDto> {
    return toDetailDto(
      await this.queries.execute(new GetPackageQuery(id, ownerOf(scope))),
    );
  }

  async overview(
    request: PackagesOverviewRequest,
  ): Promise<PackagesOverviewResponse> {
    const view = await this.queries.execute(
      new GetPackagesOverviewQuery(request.from, request.to),
    );

    return toOverviewDto(view, request);
  }
}

/**
 * The contract's scope as the use cases take it: an account id, or `null` for
 * every submission the office holds.
 *
 * The one place the two spellings meet. The contract says it as an object so
 * that `null` is a decision somebody wrote down rather than an argument they
 * forgot; the commands say it as the id, because that is what they put in a
 * WHERE clause.
 */
function ownerOf(scope: PackageScope): string | null {
  return scope === null ? null : scope.ownerAccountId;
}
