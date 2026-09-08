import type {
  AddFilesRequest,
  CreatePackageRequest,
  ListPackagesRequest,
  ListPackagesResponse,
  PackageDetailDto,
  PackageDto,
} from '../dto/index.js';

/**
 * What the verification context offers callers about submissions. Both sides of
 * every call import this: the context's service implements it, the gateway's
 * client port mirrors it, and the compiler keeps them the same shape.
 */
export interface PackagesApi {
  create(request: CreatePackageRequest): Promise<PackageDto>;
  /**
   * One page of the submissions, newest first, narrowed by what the caller
   * asked for. Never the whole list: it grows with every submission the office
   * takes in, and a call that returned all of them would be a call that gets
   * slower every week (ADR-0015).
   *
   * `ListPackagesRequestSchema` states what a search term matches and what the
   * two filters mean. They are two filters and not one because they answer two
   * questions — where the submission stands, and what the run found.
   */
  findMany(request: ListPackagesRequest): Promise<ListPackagesResponse>;
  findOne(id: string): Promise<PackageDetailDto>;

  /**
   * Adds files to a package that already exists, and answers with the package
   * as it now stands.
   *
   * Allowed in the states `PackageStatusTakingFilesSchema` names, and refused
   * with `PACKAGE_NOT_TAKING_FILES` while a run is under way. A package that
   * had been reported on is re-opened: the report, the cross-document checks
   * and the register's answers were all worked out over an envelope that has
   * since changed, so they are discarded and the package is verified afresh.
   * What was read off each file on its own — its sheets, their text, the
   * documents carved out of them — survives (ADR-0013).
   */
  addFiles(id: string, request: AddFilesRequest): Promise<PackageDto>;
}
