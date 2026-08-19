import { Query } from "@nestjs/cqrs";

import type { PackageSummaryView } from "../../read-models/index.js";

export class ListPackagesQuery extends Query<readonly PackageSummaryView[]> {}
