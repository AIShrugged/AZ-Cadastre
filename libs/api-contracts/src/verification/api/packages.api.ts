import type {
  CreatePackageRequest,
  PackageDetailDto,
  PackageDto,
} from "../dto/index.js";

/**
 * What the verification context offers callers about submissions. Both sides of
 * every call import this: the context's service implements it, the gateway's
 * client port mirrors it, and the compiler keeps them the same shape.
 */
export interface PackagesApi {
  create(request: CreatePackageRequest): Promise<PackageDto>;
  list(): Promise<PackageDto[]>;
  findOne(id: string): Promise<PackageDetailDto>;
}
