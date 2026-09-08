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
  PackagesOverviewRequest,
  PackagesOverviewResponse,
} from '@cadastre/api-contracts/verification';

import {
  AddFilesCommand,
  ApproveArchiveSearchCommand,
  CreatePackageCommand,
  GetPackageQuery,
  GetPackagesOverviewQuery,
  GetPackageSummaryQuery,
  ListPackagesQuery,
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

  async create(request: CreatePackageRequest): Promise<PackageDto> {
    const packageId = await this.commands.execute(
      new CreatePackageCommand(request.profileKey, request.files),
    );

    return toSummaryDto(
      await this.queries.execute(new GetPackageSummaryQuery(packageId.value)),
    );
  }

  async addFiles(id: string, request: AddFilesRequest): Promise<PackageDto> {
    const packageId = await this.commands.execute(
      new AddFilesCommand(id, request.files),
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

    return this.findOne(packageId.value);
  }

  async findMany(request: ListPackagesRequest): Promise<ListPackagesResponse> {
    const page = await this.queries.execute(
      new ListPackagesQuery(
        request.search,
        request.standing,
        request.reportStatus,
        request.limit,
        request.offset,
      ),
    );

    return toListDto(page, request);
  }

  async findOne(id: string): Promise<PackageDetailDto> {
    return toDetailDto(await this.queries.execute(new GetPackageQuery(id)));
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
