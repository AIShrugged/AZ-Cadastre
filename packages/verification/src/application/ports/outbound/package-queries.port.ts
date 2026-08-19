import type { PackageId } from "../../../domain/value-objects/index.js";
import type {
  PackageDetailView,
  PackageSummaryView,
} from "../../read-models/index.js";

export abstract class PackageQueries {
  abstract listSummaries(): Promise<readonly PackageSummaryView[]>;

  abstract findSummary(id: PackageId): Promise<PackageSummaryView | null>;

  abstract findDetail(id: PackageId): Promise<PackageDetailView | null>;
}
