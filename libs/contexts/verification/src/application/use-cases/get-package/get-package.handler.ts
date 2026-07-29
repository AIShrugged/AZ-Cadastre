import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";

import { PackageId } from "../../../domain/value-objects/index.js";
import { PackageNotFoundException } from "../../exceptions/index.js";
import { PackageQueries } from "../../ports/index.js";
import type { PackageDetailView } from "../../read-models/index.js";
import { GetPackageQuery } from "./get-package.query.js";

@QueryHandler(GetPackageQuery)
export class GetPackageHandler
  implements IQueryHandler<GetPackageQuery, PackageDetailView>
{
  constructor(private readonly packages: PackageQueries) {}

  async execute(query: GetPackageQuery): Promise<PackageDetailView> {
    const packageId = PackageId.of(query.packageId);
    const detail = await this.packages.findDetail(packageId);

    if (!detail) throw new PackageNotFoundException(packageId);

    return detail;
  }
}
