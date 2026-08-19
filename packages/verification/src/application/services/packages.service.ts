import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import type {
  CreatePackageRequest,
  PackageDetailDto,
  PackageDto,
  PackagesApi,
} from '@cadastre/api-contracts/verification';

import {
  CreatePackageCommand,
  GetPackageQuery,
  GetPackageSummaryQuery,
  ListPackagesQuery,
} from '../use-cases/index.js';

import { toDetailDto, toSummaryDto } from './package.presenter.js';

/**
 * Implements the contract's packages slice and does nothing else: one dispatch
 * to a use case, one presenter call. No rule lives here.
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

  async list(): Promise<PackageDto[]> {
    const summaries = await this.queries.execute(new ListPackagesQuery());

    return summaries.map(toSummaryDto);
  }

  async findOne(id: string): Promise<PackageDetailDto> {
    return toDetailDto(await this.queries.execute(new GetPackageQuery(id)));
  }
}
