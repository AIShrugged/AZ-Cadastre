import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import type {
  AddFilesRequest,
  CreatePackageRequest,
  ListPackagesRequest,
  ListPackagesResponse,
  PackageDetailDto,
  PackageDto,
  PackagesApi,
} from '@cadastre/api-contracts/verification';

import {
  AddFilesCommand,
  CreatePackageCommand,
  GetPackageQuery,
  GetPackageSummaryQuery,
  ListPackagesQuery,
} from '../use-cases/index.js';
import {
  toDetailDto,
  toListDto,
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
}
