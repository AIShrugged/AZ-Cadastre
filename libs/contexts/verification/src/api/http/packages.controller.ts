import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import {
  CreatePackageRequestSchema,
  type PackageDetailDto,
  type PackageDto,
} from "@cadastre/contracts";
import { z } from "zod";

import {
  CreatePackageCommand,
  GetPackageQuery,
  GetPackageSummaryQuery,
  ListPackagesQuery,
} from "../../application/use-cases/index.js";
import { toDetailDto, toSummaryDto } from "./package.presenter.js";

@Controller("packages")
export class PackagesController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Post()
  async create(@Body() body: unknown): Promise<PackageDto> {
    const parsed = CreatePackageRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(z.flattenError(parsed.error));
    }

    const packageId = await this.commands.execute(
      new CreatePackageCommand(parsed.data.profileKey, parsed.data.documents),
    );

    return toSummaryDto(
      await this.queries.execute(new GetPackageSummaryQuery(packageId.value)),
    );
  }

  @Get()
  async list(): Promise<PackageDto[]> {
    const summaries = await this.queries.execute(new ListPackagesQuery());

    return summaries.map(toSummaryDto);
  }

  @Get(":id")
  async detail(@Param("id") id: string): Promise<PackageDetailDto> {
    return toDetailDto(await this.queries.execute(new GetPackageQuery(id)));
  }
}
