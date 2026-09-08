import type {
  AddFilesRequest,
  ApproveArchiveSearchRequest,
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

  /**
   * Records a person's approval of what the archive register answered about
   * this submission, and answers with the package as it now stands.
   *
   * The decision is about the submission and never about the register: the
   * register states what its own fonds hold and passes judgement on nobody's
   * application (ADR-0009). It is the one thing in a package a person puts
   * there rather than the engine, and it carries no author because the system
   * has no accounts to read one from (ADR-0016).
   *
   * Refused with `ARCHIVE_SEARCH_NOT_SETTLED` while a run could still replace
   * those answers, with `ARCHIVE_SEARCH_NOT_ASKED` where the register was never
   * asked anything, and with `ARCHIVE_SEARCH_ALREADY_APPROVED` where one is
   * already in force — an approval ends by the search being made again, never
   * by being overwritten.
   */
  approveArchiveSearch(
    id: string,
    request: ApproveArchiveSearchRequest,
  ): Promise<PackageDetailDto>;
}
